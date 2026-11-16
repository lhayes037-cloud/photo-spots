/* Photo Spots: finds photo-worthy places near you using OpenStreetMap data.
   Pure helper functions are at the top so they can be tested without a browser. */

var CATS = {
  beach:      { label: 'Beach',       tip: 'Best at sunrise and golden hour. Lots of open space for couples, portraits and seascapes.' },
  pier:       { label: 'Pier',        tip: 'Great leading lines and water views. Try sunrise, sunset or blue hour. Good for portraits with the rails behind you.' },
  viewpoint:  { label: 'Viewpoint',   tip: 'Someone marked this as a view worth stopping for. Check it near golden hour.' },
  lighthouse: { label: 'Lighthouse',  tip: 'A strong subject on its own. Good for wide shots at sunset and for couples with the tower behind them.' },
  art:        { label: 'Mural / art', tip: 'Color and texture. Good for portraits and social content. Overcast days keep the light even.' },
  bridge:     { label: 'Bridge',      tip: 'Lines and reflections. Try blue hour, or long exposures after dark.' },
  historic:   { label: 'Historic',    tip: 'Character and texture for portraits and couples. Check for any photo rules before bringing gear.' },
  nature:     { label: 'Nature',      tip: 'Wildlife and birds. Early morning is usually the most active. Bring a long lens.' },
  garden:     { label: 'Garden',      tip: 'Soft light and color. Good for portraits and couples, especially on cloudy days.' },
  park:       { label: 'Park',        tip: 'Open space and trees. Good for portraits and family sessions. Look for shade or backlit golden hour.' },
  other:      { label: 'Other',       tip: 'A spot you added yourself.' }
};

var CAT_ORDER = ['beach', 'pier', 'viewpoint', 'lighthouse', 'art', 'bridge', 'historic', 'nature', 'garden', 'park', 'other'];

var SHOOTS = {
  portraits: 'Portraits',
  couples:   'Couples',
  wildlife:  'Wildlife',
  landscape: 'Landscape',
  social:    'Social / urban'
};
var SHOOT_ORDER = ['portraits', 'couples', 'wildlife', 'landscape', 'social'];

var CAT_SHOOTS = {
  beach:      ['couples', 'landscape', 'portraits'],
  pier:       ['portraits', 'landscape', 'couples'],
  viewpoint:  ['landscape', 'couples'],
  lighthouse: ['landscape', 'couples'],
  art:        ['portraits', 'social'],
  bridge:     ['landscape', 'social'],
  historic:   ['portraits', 'couples', 'social'],
  nature:     ['wildlife', 'landscape'],
  garden:     ['portraits', 'couples'],
  park:       ['portraits', 'wildlife', 'couples'],
  other:      ['portraits', 'couples', 'wildlife', 'landscape', 'social']
};

function categorize(t) {
  if (!t) return null;
  if (t.man_made === 'lighthouse') return 'lighthouse';
  if (t.man_made === 'pier') return 'pier';
  if (t.natural === 'beach') return 'beach';
  if (t.tourism === 'viewpoint') return 'viewpoint';
  if (t.tourism === 'artwork') return 'art';
  if (t.man_made === 'bridge') return 'bridge';
  if (t.historic && /^(monument|memorial|ruins|castle|fort|building|archaeological_site)$/.test(t.historic)) return 'historic';
  if (t.leisure === 'nature_reserve') return 'nature';
  if (t.leisure === 'garden') return 'garden';
  if (t.leisure === 'park') return 'park';
  return null;
}

function fallbackName(cat, t) {
  if (cat === 'art') return t.artwork_type === 'mural' ? 'Mural' : 'Public art';
  if (cat === 'viewpoint') return 'Viewpoint';
  if (cat === 'lighthouse') return 'Lighthouse';
  return null;
}

function milesBetween(lat1, lon1, lat2, lon2) {
  var R = 3958.8, rad = Math.PI / 180;
  var dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildQuery(lat, lon, miles) {
  var r = Math.round(miles * 1609.34);
  var a = '(around:' + r + ',' + lat.toFixed(5) + ',' + lon.toFixed(5) + ')';
  return '[out:json][timeout:25];(' +
    'nwr["natural"="beach"]["name"]' + a + ';' +
    'nwr["leisure"="park"]["name"]' + a + ';' +
    'nwr["leisure"="nature_reserve"]["name"]' + a + ';' +
    'nwr["leisure"="garden"]["name"]' + a + ';' +
    'nwr["man_made"="pier"]["name"]' + a + ';' +
    'nwr["tourism"="viewpoint"]' + a + ';' +
    'nwr["tourism"="artwork"]' + a + ';' +
    'nwr["man_made"="lighthouse"]' + a + ';' +
    'nwr["man_made"="bridge"]["name"]' + a + ';' +
    'nwr["historic"~"^(monument|memorial|ruins|castle|fort|building|archaeological_site)$"]["name"]' + a + ';' +
    ');out center tags 600;';
}

/* Turns raw OpenStreetMap elements into a clean list of spots, nearest first. */
function parseElements(elements, lat, lon) {
  var best = {};
  var out = [];
  (elements || []).forEach(function (el) {
    var t = el.tags || {};
    var cat = categorize(t);
    if (!cat) return;
    var elat = el.lat != null ? el.lat : (el.center && el.center.lat);
    var elon = el.lon != null ? el.lon : (el.center && el.center.lon);
    if (elat == null || elon == null) return;
    var name = t.name || fallbackName(cat, t);
    if (!name) return;
    var spot = {
      id: el.type + '/' + el.id,
      name: name,
      cat: cat,
      lat: elat,
      lon: elon,
      info: {
        description: t.description || '',
        website: t.website || t['contact:website'] || '',
        wikipedia: t.wikipedia || '',
        hours: t.opening_hours || '',
        fee: t.fee || '',
        access: t.access || '',
        wheelchair: t.wheelchair || ''
      },
      dist: milesBetween(lat, lon, elat, elon)
    };
    if (t.name) {
      var key = cat + '|' + t.name.toLowerCase();
      if (best[key] === undefined) { best[key] = out.length; out.push(spot); }
      else if (spot.dist < out[best[key]].dist) { out[best[key]] = spot; }
    } else {
      out.push(spot);
    }
  });
  out.sort(function (a, b) { return a.dist - b.dist; });
  return out;
}

/* ---------- Sun times (no internet needed) ---------- */
/* Based on the standard NOAA sunrise/sunset method. Returns real Date objects. */
function sunEvents(dayDate, lat, lon) {
  var rad = Math.PI / 180, deg = 180 / Math.PI;
  var y = dayDate.getFullYear(), m = dayDate.getMonth(), d = dayDate.getDate();
  var utcMidnight = Date.UTC(y, m, d);
  var jd = utcMidnight / 86400000 + 2440587.5 + 0.5; // that day at noon UTC
  var T = (jd - 2451545.0) / 36525.0;
  var L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
  var M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  var e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  var C = Math.sin(M * rad) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
          Math.sin(2 * M * rad) * (0.019993 - 0.000101 * T) +
          Math.sin(3 * M * rad) * 0.000289;
  var trueLong = L0 + C;
  var omega = 125.04 - 1934.136 * T;
  var lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * rad);
  var eps0 = 23 + (26 + ((21.448 - T * (46.815 + T * (0.00059 - T * 0.001813)))) / 60) / 60;
  var eps = eps0 + 0.00256 * Math.cos(omega * rad);
  var decl = Math.asin(Math.sin(eps * rad) * Math.sin(lambda * rad));
  var yy = Math.tan(eps * rad / 2); yy = yy * yy;
  var eqTime = 4 * deg * (yy * Math.sin(2 * L0 * rad) - 2 * e * Math.sin(M * rad) +
    4 * e * yy * Math.sin(M * rad) * Math.cos(2 * L0 * rad) -
    0.5 * yy * yy * Math.sin(4 * L0 * rad) - 1.25 * e * e * Math.sin(2 * M * rad));
  var noonMin = 720 - 4 * lon - eqTime; // minutes after 00:00 UTC

  function crossing(alt, evening) {
    var c = (Math.sin(alt * rad) - Math.sin(lat * rad) * Math.sin(decl)) / (Math.cos(lat * rad) * Math.cos(decl));
    if (c > 1 || c < -1) return null;
    var H = Math.acos(c) * deg;
    var min = noonMin + (evening ? 4 * H : -4 * H);
    return new Date(utcMidnight + min * 60000);
  }
  return {
    dawn:          crossing(-6, false),
    sunrise:       crossing(-0.833, false),
    goldenMorningEnd: crossing(6, false),
    goldenEveningStart: crossing(6, true),
    sunset:        crossing(-0.833, true),
    dusk:          crossing(-6, true)
  };
}

function fmtTime(dt) {
  if (!dt || isNaN(dt.getTime())) return 'n/a';
  return dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/* ---------- Weather in plain words ---------- */
function weatherVerdict(clouds, rain) {
  if (rain >= 50) return { text: 'Rain likely. Skip it or bring cover.', tone: 'bad' };
  if (rain >= 30) return { text: 'Some chance of rain. Check again before you go.', tone: 'ok' };
  if (clouds <= 15) return { text: 'Clear sky. Strong, clean light, but the sunset can look plain.', tone: 'ok' };
  if (clouds <= 60) return { text: 'Partly cloudy. Usually the best for color and drama.', tone: 'good' };
  if (clouds <= 85) return { text: 'Mostly cloudy. Soft, even light that is good for portraits.', tone: 'ok' };
  return { text: 'Heavy cloud. Flat, gray light.', tone: 'bad' };
}

/* Finds the hourly forecast entry closest to a given time. hourly.time holds local strings like 2026-11-07T17:00 */
function pickHour(hourly, when) {
  if (!hourly || !hourly.time || !when || isNaN(when.getTime())) return -1;
  var t = new Date(when.getTime() + 30 * 60000); // round to nearest hour
  function p(n) { return (n < 10 ? '0' : '') + n; }
  var key = t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate()) + 'T' + p(t.getHours()) + ':00';
  return hourly.time.indexOf(key);
}

/* ---------- Popularity (Flickr) ---------- */
function flickrTier(n) {
  if (n == null) return '';
  if (n >= 300) return 'Very popular';
  if (n >= 60) return 'Popular';
  if (n >= 10) return 'Some photos';
  return '';
}

/* ---------- Filtering ---------- */
function filterSpots(spots, cat, shoot) {
  return spots.filter(function (s) {
    if (cat && cat !== 'all' && s.cat !== cat) return false;
    if (shoot && shoot !== 'all' && (CAT_SHOOTS[s.cat] || []).indexOf(shoot) === -1) return false;
    return true;
  });
}

/* ---------- Best right now ---------- */
/* Which kind of light each place type shines in. Open spots (water, views) love golden hour.
   Shady or colorful spots (parks, gardens, murals) also work well under soft cloud cover.
   Nature spots are best early in the morning. */
var CAT_LIGHT = {
  beach: 'edge', pier: 'edge', viewpoint: 'edge', lighthouse: 'edge', bridge: 'edge',
  nature: 'morning',
  art: 'soft', garden: 'soft', park: 'soft', historic: 'soft',
  other: 'any'
};

function fmtMins(m) {
  m = Math.max(1, Math.round(m));
  if (m < 60) return m + ' min';
  var h = Math.floor(m / 60), r = m % 60;
  return h + ' hr' + (r ? ' ' + r + ' min' : '');
}

/* Tells us if we are inside golden or blue hour right now, or how long until the next one. */
function lightWindow(now, evToday, evTomorrow) {
  var t = now.getTime();
  function ms(d) { return d && !isNaN(d.getTime()) ? d.getTime() : null; }
  var dark = false;
  if (ms(evToday.dawn) != null && ms(evToday.dusk) != null) dark = t < ms(evToday.dawn) || t >= ms(evToday.dusk);
  var wins = [
    { start: ms(evToday.dawn), end: ms(evToday.sunrise), kind: 'blue', side: 'morning' },
    { start: ms(evToday.sunrise), end: ms(evToday.goldenMorningEnd), kind: 'golden', side: 'morning' },
    { start: ms(evToday.goldenEveningStart), end: ms(evToday.sunset), kind: 'golden', side: 'evening' },
    { start: ms(evToday.sunset), end: ms(evToday.dusk), kind: 'blue', side: 'evening' }
  ];
  if (evTomorrow) {
    wins.push({ start: ms(evTomorrow.dawn), end: ms(evTomorrow.sunrise), kind: 'blue', side: 'morning' });
    wins.push({ start: ms(evTomorrow.sunrise), end: ms(evTomorrow.goldenMorningEnd), kind: 'golden', side: 'morning' });
  }
  var i, w, next = null;
  for (i = 0; i < wins.length; i++) {
    w = wins[i];
    if (w.start == null || w.end == null) continue;
    if (t >= w.start && t < w.end) {
      return { phase: 'now', kind: w.kind, side: w.side, minutes: 0, endsIn: (w.end - t) / 60000, dark: dark };
    }
    if (w.start > t && (!next || w.start < next.start)) next = w;
  }
  if (next) return { phase: 'soon', kind: next.kind, side: next.side, minutes: (next.start - t) / 60000, dark: dark };
  return { phase: 'none', dark: dark };
}

/* Gives a spot a score for right now, plus a short reason in plain words.
   ctx = { light, clouds, rain, ratings, catAvg, saved, flickrOf } */
function scoreSpot(s, ctx) {
  var score = 0, reasons = [];
  function add(pts, text) {
    score += pts;
    if (text && pts > 0) reasons.push({ pts: pts, text: text });
  }
  var lw = ctx.light || { phase: 'none' };
  var fit = CAT_LIGHT[s.cat] || 'any';

  function mult(side) {
    if (fit === 'morning') return side === 'morning' ? 1 : 0.5;
    if (fit === 'soft') return 0.7;
    if (fit === 'any') return 0.8;
    return 1;
  }

  if (lw.phase === 'now') {
    add((lw.kind === 'golden' ? 30 : 18) * mult(lw.side),
      (lw.kind === 'golden' ? 'Golden hour right now' : 'Blue hour right now') + ' (ends in ' + fmtMins(lw.endsIn) + ')');
  } else if (lw.phase === 'soon') {
    var limit = lw.kind === 'golden' ? 120 : 90;
    if (lw.minutes <= limit) {
      add((lw.kind === 'golden' ? 26 : 14) * mult(lw.side) * (1 - lw.minutes / limit),
        (lw.kind === 'golden' ? 'Golden hour starts in ' : 'Blue hour starts in ') + fmtMins(lw.minutes));
    }
  }

  if (fit === 'soft' && lw.phase !== 'now' && !lw.dark && ctx.clouds != null &&
      ctx.clouds >= 40 && ctx.clouds <= 90 && (ctx.rain == null || ctx.rain < 30)) {
    add(14, 'Soft cloud cover right now, easy light for portraits');
  }

  var r = ctx.ratings && ctx.ratings[s.id];
  if (r) {
    add((r.n - 3) * 8, r.n >= 4 ? 'You rated this ' + r.n + ' stars' : '');
  } else if (ctx.catAvg && ctx.catAvg[s.cat] != null) {
    add((ctx.catAvg[s.cat] - 3) * 4, ctx.catAvg[s.cat] >= 4 ? 'You like places like this' : '');
  }

  var n = ctx.flickrOf ? ctx.flickrOf(s.id) : null;
  if (n != null) {
    if (n >= 300) add(12, 'Very popular with photographers');
    else if (n >= 60) add(8, 'Popular with photographers');
    else if (n >= 10) add(3, '');
  }
  if (ctx.saved && ctx.saved[s.id]) add(5, 'You saved this');

  score -= 1.5 * Math.min(s.dist || 0, 20);

  var why = '';
  reasons.forEach(function (x) { if (!why || x.pts > why.pts) why = x; });
  why = why ? why.text : '';
  if (!why) {
    var shoots = (CAT_SHOOTS[s.cat] || []).slice(0, 2).map(function (k) { return SHOOTS[k].toLowerCase(); });
    if (shoots.length && s.cat !== 'other') why = 'Good for ' + shoots.join(' and ');
  }
  return { score: score, why: why };
}

/* What other photographers shoot here, from the tags on their Flickr photos. */
var TAG_WORDS = ['sunset', 'sunrise', 'portrait', 'wedding', 'engagement', 'couple', 'family', 'bird', 'wildlife',
  'mural', 'streetphotography', 'seascape', 'landscape', 'skyline', 'fishing', 'surf', 'beach'];

function topTags(photos, n) {
  var counts = {};
  (photos || []).forEach(function (p) {
    var seen = {};
    String(p.tags || '').toLowerCase().split(/\s+/).forEach(function (t) {
      if (TAG_WORDS.indexOf(t) !== -1 && !seen[t]) { seen[t] = 1; counts[t] = (counts[t] || 0) + 1; }
    });
  });
  return Object.keys(counts).filter(function (k) { return counts[k] >= 3; })
    .sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, n || 3);
}

if (typeof module !== 'undefined') {
  module.exports = {
    CATS: CATS, CAT_ORDER: CAT_ORDER, SHOOTS: SHOOTS, SHOOT_ORDER: SHOOT_ORDER, CAT_SHOOTS: CAT_SHOOTS,
    categorize: categorize, milesBetween: milesBetween, buildQuery: buildQuery, parseElements: parseElements,
    sunEvents: sunEvents, fmtTime: fmtTime, weatherVerdict: weatherVerdict, pickHour: pickHour,
    flickrTier: flickrTier, filterSpots: filterSpots,
    CAT_LIGHT: CAT_LIGHT, fmtMins: fmtMins, lightWindow: lightWindow, scoreSpot: scoreSpot, topTags: topTags
  };
}

/* ---------------- Browser app ---------------- */
if (typeof document !== 'undefined') {
(function () {
  var ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
  ];
  var CACHE_HOURS = 6;
  var FLICKR_DAYS = 14;

  var $ = function (id) { return document.getElementById(id); };
  var state = {
    pos: null, miles: 10, osm: [], filter: 'all', shoot: 'all', sort: 'best', selected: null,
    saved: {}, mine: {}, notes: {}, map: null, markers: {}, meMarker: null, view: 'list',
    day: 0, weather: null, flickrKey: '', flickr: {}, picking: false, draft: null,
    ratings: {}, flPhotos: {}, flLoading: {}
  };

  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  state.saved = lsGet('ps:saved') || {};
  state.mine = lsGet('ps:mine') || {};
  state.notes = lsGet('ps:notes') || {};
  state.ratings = lsGet('ps:rate') || {};
  state.flickr = lsGet('ps:fl') || {};
  state.flickrKey = lsGet('ps:flkey') || '';
  var savedMiles = lsGet('ps:miles');
  if (savedMiles) state.miles = savedMiles;

  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
  function fmtDist(d) { return d < 0.1 ? 'Under 0.1 mi' : (d < 10 ? d.toFixed(1) : Math.round(d)) + ' mi'; }

  /* Background updates (weather, Flickr counts) must never rebuild the page while you are typing a note. */
  function safeRender() {
    var a = document.activeElement;
    if (a && a.id === 'noteBox') return;
    render();
  }

  /* ---------- combined list ---------- */
  function mineList() {
    var arr = [];
    Object.keys(state.mine).forEach(function (id) {
      var s = state.mine[id];
      arr.push({ id: s.id, name: s.name, cat: s.cat, lat: s.lat, lon: s.lon, info: {}, mine: true,
        dist: state.pos ? milesBetween(state.pos.lat, state.pos.lon, s.lat, s.lon) : 0 });
    });
    return arr;
  }

  function allSpots() {
    var base = state.osm.concat(mineList());
    base.sort(function (a, b) { return a.dist - b.dist; });
    return base;
  }

  function savedList() {
    var arr = [];
    Object.keys(state.saved).forEach(function (id) {
      var s = state.saved[id];
      var live = state.mine[id];
      var src = live || s;
      arr.push({ id: src.id, name: src.name, cat: src.cat, lat: src.lat, lon: src.lon, info: src.info || {}, mine: !!live,
        dist: state.pos ? milesBetween(state.pos.lat, state.pos.lon, src.lat, src.lon) : 0 });
    });
    arr.sort(function (a, b) { return a.dist - b.dist; });
    return arr;
  }

  /* Average star rating you gave each kind of place, so the app learns what you like. */
  function catAverages() {
    var sum = {}, cnt = {}, out = {};
    Object.keys(state.ratings).forEach(function (id) {
      var r = state.ratings[id];
      sum[r.cat] = (sum[r.cat] || 0) + r.n;
      cnt[r.cat] = (cnt[r.cat] || 0) + 1;
    });
    Object.keys(sum).forEach(function (c) { out[c] = sum[c] / cnt[c]; });
    return out;
  }

  function bestCtx() {
    var light = { phase: 'none' }, w = null;
    if (state.pos) {
      var now = new Date();
      light = lightWindow(now, sunEvents(dayDate(0), state.pos.lat, state.pos.lon), sunEvents(dayDate(1), state.pos.lat, state.pos.lon));
      w = weatherAt(now);
    }
    return { light: light, clouds: w ? w.clouds : null, rain: w ? w.rain : null,
      ratings: state.ratings, catAvg: catAverages(), saved: state.saved, flickrOf: flickrCount };
  }

  function visibleSpots() {
    var base;
    if (state.filter === 'saved') base = savedList();
    else if (state.filter === 'mine') base = mineList().sort(function (a, b) { return a.dist - b.dist; });
    else base = filterSpots(allSpots(), state.filter, null);
    base = filterSpots(base, null, state.shoot);
    var ctx = bestCtx();
    base.forEach(function (s) { var r = scoreSpot(s, ctx); s.score = r.score; s.why = r.why; });
    if (state.sort === 'best') {
      base = base.slice().sort(function (a, b) { return b.score - a.score || a.dist - b.dist; });
    } else if (state.sort === 'popular') {
      base = base.slice().sort(function (a, b) {
        var fa = flickrCount(a.id), fb = flickrCount(b.id);
        if (fa == null && fb == null) return a.dist - b.dist;
        if (fa == null) return 1;
        if (fb == null) return -1;
        return fb - fa || a.dist - b.dist;
      });
    }
    return base;
  }

  /* ---------- location ---------- */
  function getLocation() {
    setStatus('Finding where you are...');
    if (!navigator.geolocation) { showMessage('This browser can\'t share your location.', true); return; }
    navigator.geolocation.getCurrentPosition(function (p) {
      state.pos = { lat: p.coords.latitude, lon: p.coords.longitude };
      loadWeather();
      renderLightBar();
      loadSpots();
    }, function (err) {
      var msg = err && err.code === 1
        ? 'Location is turned off for this app. Turn it on in your browser settings for this site, then tap Try again.'
        : 'Couldn\'t get your location. Make sure location is on, then tap Try again.';
      showMessage(msg, true);
    }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 });
  }

  /* ---------- OpenStreetMap data ---------- */
  function cacheKey() { return 'ps:c:' + state.pos.lat.toFixed(2) + ',' + state.pos.lon.toFixed(2) + ':' + state.miles; }

  function loadSpots(force) {
    var key = cacheKey();
    var cached = lsGet(key);
    if (!force && cached && Date.now() - cached.t < CACHE_HOURS * 3600 * 1000) {
      state.osm = parseElements(cached.elements, state.pos.lat, state.pos.lon);
      afterLoad();
      return;
    }
    setStatus('Looking for spots near you...');
    fetchOverpass(buildQuery(state.pos.lat, state.pos.lon, state.miles), 0).then(function (json) {
      var els = json.elements || [];
      lsSet(key, { t: Date.now(), elements: els });
      state.osm = parseElements(els, state.pos.lat, state.pos.lon);
      afterLoad();
    }).catch(function () {
      if (cached) {
        state.osm = parseElements(cached.elements, state.pos.lat, state.pos.lon);
        afterLoad('Showing saved results. Couldn\'t refresh right now.');
      } else {
        showMessage('The map data service didn\'t answer. Check your connection and tap Try again.', true);
        // your own spots can still show
        if (Object.keys(state.mine).length) { state.osm = []; afterLoad('Showing only your own spots for now.'); }
      }
    });
  }

  function fetchOverpass(query, i) {
    if (i >= ENDPOINTS.length) return Promise.reject(new Error('all failed'));
    return fetch(ENDPOINTS[i], {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(query)
    }).then(function (r) {
      if (!r.ok) throw new Error('bad status');
      return r.json();
    }).catch(function () { return fetchOverpass(query, i + 1); });
  }

  function afterLoad(note) {
    state.selected = null;
    buildFilters();
    render();
    drawMap();
    var total = allSpots().length;
    setStatus(note || (total + ' spots within ' + state.miles + ' miles'));
    if (!total) showMessage('No spots found in this area. Try a bigger distance, or add your own spot with the + button.', false);
    else hideMessage();
    $('refresh').hidden = false;
    if (state.flickrKey) loadFlickr();
  }

  /* ---------- weather (Open-Meteo, free, no key) ---------- */
  function loadWeather() {
    var cacheK = 'ps:w:' + state.pos.lat.toFixed(1) + ',' + state.pos.lon.toFixed(1);
    var c = lsGet(cacheK);
    if (c && Date.now() - c.t < 3600 * 1000) { state.weather = c.data; renderLightBar(); if (state.selected) safeRender(); return; }
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + state.pos.lat.toFixed(3) + '&longitude=' + state.pos.lon.toFixed(3) +
      '&hourly=cloud_cover,precipitation_probability,temperature_2m&temperature_unit=fahrenheit&timezone=auto&forecast_days=3';
    fetch(url).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) {
      state.weather = j;
      lsSet(cacheK, { t: Date.now(), data: j });
      renderLightBar();
      if (state.selected) safeRender();
    }).catch(function () { /* weather is a bonus, stay quiet */ });
  }

  function dayDate(offset) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + offset); return d; }

  function weatherAt(when) {
    var h = state.weather && state.weather.hourly;
    var i = pickHour(h, when);
    if (i < 0) return null;
    return { clouds: h.cloud_cover[i], rain: h.precipitation_probability[i], temp: h.temperature_2m[i] };
  }

  function renderLightBar() {
    var bar = $('lightbar');
    if (!state.pos) { bar.hidden = true; return; }
    var ev = sunEvents(dayDate(0), state.pos.lat, state.pos.lon);
    var txt = 'Today: sunrise ' + fmtTime(ev.sunrise) + ', golden hour ' + fmtTime(ev.goldenEveningStart) + ', sunset ' + fmtTime(ev.sunset);
    var w = weatherAt(ev.goldenEveningStart);
    if (w) txt += '. Evening sky: ' + weatherVerdict(w.clouds, w.rain).text.split('.')[0].toLowerCase();
    bar.textContent = txt;
    bar.hidden = false;
  }

  /* ---------- Flickr popularity (optional) ---------- */
  function flickrCount(id) {
    var f = state.flickr[id];
    if (!f) return null;
    if (Date.now() - f.t > FLICKR_DAYS * 86400000) return null;
    return f.n;
  }

  var flickrBusy = false;
  function loadFlickr() {
    if (!state.flickrKey || flickrBusy) return;
    var todo = allSpots().slice(0, 40).filter(function (s) { return flickrCount(s.id) == null; });
    if (!todo.length) return;
    flickrBusy = true;
    var failed = false;
    function one(s) {
      var url = 'https://api.flickr.com/services/rest/?method=flickr.photos.search&api_key=' + encodeURIComponent(state.flickrKey) +
        '&lat=' + s.lat + '&lon=' + s.lon + '&radius=0.2&radius_units=km&has_geo=1&per_page=1&format=json&nojsoncallback=1';
      return fetch(url).then(function (r) { return r.json(); }).then(function (j) {
        if (j.stat !== 'ok') { failed = true; return; }
        state.flickr[s.id] = { n: parseInt(j.photos.total, 10) || 0, t: Date.now() };
      }).catch(function () { failed = true; });
    }
    var i = 0;
    function next() {
      if (failed || i >= todo.length) {
        lsSet('ps:fl', state.flickr);
        flickrBusy = false;
        if (failed) setStatus('Flickr didn\'t answer. Check your key in Settings.');
        safeRender(); drawMap();
        return;
      }
      var batch = todo.slice(i, i + 4); i += 4;
      Promise.all(batch.map(one)).then(function () { safeRender(); next(); });
    }
    next();
  }

  /* Photos other people took near a spot, most interesting first. Loads only when you ask. */
  function loadPhotos(s) {
    if (!state.flickrKey || state.flLoading[s.id]) return;
    state.flLoading[s.id] = true;
    safeRender();
    var url = 'https://api.flickr.com/services/rest/?method=flickr.photos.search&api_key=' + encodeURIComponent(state.flickrKey) +
      '&lat=' + s.lat + '&lon=' + s.lon + '&radius=0.3&radius_units=km&has_geo=1&sort=interestingness-desc' +
      '&per_page=60&extras=url_q,tags&format=json&nojsoncallback=1';
    fetch(url).then(function (r) { return r.json(); }).then(function (j) {
      if (j.stat !== 'ok') throw new Error('flickr');
      state.flPhotos[s.id] = (j.photos.photo || []).map(function (p) {
        return { id: p.id, owner: p.owner, tags: p.tags || '', url: p.url_q || '', title: p.title || '' };
      });
    }).catch(function () {
      setStatus('Flickr didn\'t answer. Check your key in Settings.');
    }).then(function () {
      state.flLoading[s.id] = false;
      safeRender();
    });
  }

  /* ---------- UI helpers ---------- */
  function setStatus(t) { $('status').textContent = t; }
  function showMessage(t, retry) {
    $('msgText').textContent = t;
    $('retry').hidden = !retry;
    $('msg').hidden = false;
    if (retry) setStatus('');
  }
  function hideMessage() { $('msg').hidden = true; }

  function buildFilters() {
    var spots = allSpots();
    var counts = {};
    spots.forEach(function (s) { counts[s.cat] = (counts[s.cat] || 0) + 1; });
    var box = $('filters');
    box.innerHTML = '<span class="rowlbl">Place</span>';
    function pill(key, label, cls) {
      var b = document.createElement('button');
      b.className = 'pill ' + (cls || '') + (state.filter === key ? ' on' : '');
      b.textContent = label;
      b.onclick = function () { state.filter = key; state.selected = null; buildFilters(); render(); drawMap(); };
      box.appendChild(b);
    }
    pill('all', 'All ' + spots.length, 'p-all');
    pill('saved', 'Saved ' + Object.keys(state.saved).length, 'p-saved');
    pill('mine', 'Mine ' + Object.keys(state.mine).length, 'p-mine');
    CAT_ORDER.forEach(function (c) {
      if (counts[c]) pill(c, CATS[c].label + ' ' + counts[c], 'p-' + c);
    });

    var sbox = $('shootFilters');
    sbox.innerHTML = '<span class="rowlbl">Shoot</span>';
    function spill(key, label) {
      var b = document.createElement('button');
      b.className = 'pill p-all' + (state.shoot === key ? ' on' : '');
      b.textContent = label;
      b.onclick = function () { state.shoot = key; state.selected = null; buildFilters(); render(); drawMap(); };
      sbox.appendChild(b);
    }
    spill('all', 'Any');
    SHOOT_ORDER.forEach(function (k) { spill(k, SHOOTS[k]); });
  }

  function render() {
    var list = $('list');
    list.innerHTML = '';
    var spots = visibleSpots();
    if (!spots.length) {
      var msg = state.filter === 'saved' ? 'Nothing saved yet. Open a spot and tap Save.'
        : state.filter === 'mine' ? 'You haven\'t added any spots yet. Tap the + button at the top.'
        : 'No spots match these filters.';
      list.innerHTML = '<p class="empty">' + msg + '</p>';
      return;
    }
    var grouped = state.sort === 'best' && spots.length > 3;
    spots.forEach(function (s, idx) {
      if (grouped && (idx === 0 || idx === 3)) {
        var lb = document.createElement('div');
        lb.className = 'lbl';
        if (idx === 0) lb.style.marginTop = '0';
        lb.textContent = idx === 0 ? 'Top picks' : 'More spots';
        list.appendChild(lb);
      }
      var card = document.createElement('div');
      card.className = 'card' + (state.selected === s.id ? ' open' : '');
      card.id = 'card-' + s.id.replace('/', '-');

      var tier = flickrTier(flickrCount(s.id));
      var head = document.createElement('button');
      head.className = 'cardHead';
      head.innerHTML = '<span class="cardMain"><span class="cardName">' + esc(s.name) + '</span>' +
        '<span class="cardMeta"><span class="tag p-' + s.cat + '">' + esc(CATS[s.cat].label) + '</span>' +
        (s.mine ? '<span class="tag p-mine">Mine</span>' : '') +
        (tier ? '<span class="tag p-pop">' + esc(tier) + '</span>' : '') +
        '<span class="dist">' + fmtDist(s.dist) + '</span>' +
        (state.ratings[s.id] ? '<span class="dist">&#9733;' + state.ratings[s.id].n + '</span>' : '') +
        (state.notes[s.id] ? '<span class="dist" title="Has notes">&#9998;</span>' : '') +
        '</span>' +
        (s.why ? '<span class="why">' + esc(s.why) + '</span>' : '') +
        '</span>' +
        (state.saved[s.id] ? '<span class="star on" aria-label="Saved">&#9733;</span>' : '');
      head.onclick = function () { select(state.selected === s.id ? null : s.id, true); };
      card.appendChild(head);

      if (state.selected === s.id) card.appendChild(detailPanel(s));
      list.appendChild(card);
    });
  }

  function lightBlock(s) {
    var ev = sunEvents(dayDate(state.day), s.lat, s.lon);
    var h = '<div class="lbl">Light</div>' +
      '<div class="seg"><button class="' + (state.day === 0 ? 'on' : '') + '" data-day="0">Today</button>' +
      '<button class="' + (state.day === 1 ? 'on' : '') + '" data-day="1">Tomorrow</button></div>' +
      '<dl>' +
      '<dt>Morning</dt><dd>Sunrise ' + fmtTime(ev.sunrise) + ', golden hour until ' + fmtTime(ev.goldenMorningEnd) + '</dd>' +
      '<dt>Evening</dt><dd>Golden hour ' + fmtTime(ev.goldenEveningStart) + ', sunset ' + fmtTime(ev.sunset) + '</dd>' +
      '<dt>Blue hour</dt><dd>' + fmtTime(ev.sunset) + ' to ' + fmtTime(ev.dusk) + '</dd></dl>';
    var we = weatherAt(ev.goldenEveningStart), wm = weatherAt(ev.sunrise);
    if (we || wm) {
      h += '<dl style="margin-top:8px">';
      if (wm) h += '<dt>Sky at sunrise</dt><dd>' + Math.round(wm.clouds) + '% clouds, ' + Math.round(wm.rain) + '% rain, ' + Math.round(wm.temp) + '&deg;F</dd>';
      if (we) h += '<dt>Sky at sunset</dt><dd>' + Math.round(we.clouds) + '% clouds, ' + Math.round(we.rain) + '% rain, ' + Math.round(we.temp) + '&deg;F</dd>';
      h += '</dl>';
      if (we) {
        var v = weatherVerdict(we.clouds, we.rain);
        h += '<p class="verdict v-' + v.tone + '">Evening: ' + esc(v.text) + '</p>';
      }
    }
    return h;
  }

  function detailPanel(s) {
    var d = document.createElement('div');
    d.className = 'detail';
    var shoots = (CAT_SHOOTS[s.cat] || []).map(function (k) { return '<span class="tag p-all">' + esc(SHOOTS[k]) + '</span>'; }).join(' ');
    var html = '<div class="lbl">Good for</div><p>' + esc(CATS[s.cat].tip) + '</p><div class="tags">' + shoots + '</div>';
    var rn = state.ratings[s.id] ? state.ratings[s.id].n : 0;
    html += '<div class="lbl">Your rating</div><div class="rate">';
    for (var k = 1; k <= 5; k++) {
      html += '<button data-n="' + k + '" class="' + (k <= rn ? 'on' : '') + '" aria-label="' + k + (k === 1 ? ' star' : ' stars') + '">&#9733;</button>';
    }
    html += '</div><p class="hint">Rate it after you shoot here. The app uses your ratings to rank spots for you.</p>';

    html += lightBlock(s);

    var cnt = flickrCount(s.id);
    var photos = state.flPhotos[s.id];
    html += '<div class="lbl">Other photographers</div>';
    if (cnt != null) html += '<p>About ' + cnt + ' public Flickr photos were taken within 200 meters of here.</p>';
    if (photos) {
      var tg = topTags(photos, 3);
      if (tg.length) html += '<p>Often shot for: ' + esc(tg.join(', ')) + '.</p>';
      var shown = photos.filter(function (p) { return /^https:\/\//.test(p.url); }).slice(0, 6);
      if (shown.length) {
        html += '<div class="thumbs">';
        shown.forEach(function (p) {
          html += '<a target="_blank" rel="noopener" href="https://www.flickr.com/photos/' + esc(p.owner) + '/' + esc(p.id) + '">' +
            '<img src="' + esc(p.url) + '" alt="' + esc(p.title) + '" loading="lazy"></a>';
        });
        html += '</div><p class="hint">These photos belong to the people who took them. Tap one to open it on Flickr.</p>';
      } else {
        html += '<p>No public photos found right here.</p>';
      }
    } else if (state.flickrKey) {
      html += state.flLoading[s.id]
        ? '<p class="hint">Loading photos...</p>'
        : '<div class="actions" style="margin-top:8px"><button class="btn" id="photoBtn">See photos from here</button></div>';
    } else {
      html += '<p class="hint">Add a free Flickr key to see photos other people took here.</p>' +
        '<div class="actions" style="margin-top:8px"><button class="btn" id="keyBtn">Add Flickr key</button></div>';
    }

    var i = s.info || {};
    var rows = [];
    if (i.description) rows.push(['About', esc(i.description)]);
    if (i.hours) rows.push(['Hours', esc(i.hours)]);
    if (i.fee) rows.push(['Fee', i.fee === 'yes' ? 'Yes' : (i.fee === 'no' ? 'No' : esc(i.fee))]);
    if (i.access && i.access !== 'yes') rows.push(['Access', esc(i.access)]);
    if (i.wheelchair) rows.push(['Wheelchair', esc(i.wheelchair)]);
    if (rows.length) {
      html += '<div class="lbl">Details</div><dl>';
      rows.forEach(function (r) { html += '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; });
      html += '</dl>';
    }

    html += '<div class="lbl">My notes</div><textarea id="noteBox" rows="3" placeholder="Parking, best time, what worked..."></textarea>';

    var links = '';
    var maps = 'https://www.google.com/maps/dir/?api=1&destination=' + s.lat + ',' + s.lon;
    links += '<a class="btn primary" target="_blank" rel="noopener" href="' + maps + '">Directions</a>';
    if (i.website && /^https?:\/\//.test(i.website)) links += '<a class="btn" target="_blank" rel="noopener" href="' + esc(i.website) + '">Website</a>';
    html += '<div class="actions">' + links + '<button class="btn" id="saveBtn">' + (state.saved[s.id] ? 'Saved' : 'Save') + '</button>' +
      (s.mine ? '<button class="btn danger" id="delBtn">Delete</button>' : '') + '</div>';
    d.innerHTML = html;

    var nb = d.querySelector('#noteBox');
    nb.value = state.notes[s.id] || '';
    nb.onclick = function (e) { e.stopPropagation(); };
    nb.oninput = function () {
      if (nb.value.trim()) state.notes[s.id] = nb.value; else delete state.notes[s.id];
      lsSet('ps:notes', state.notes);
    };
    nb.onblur = function () { render(); };

    d.querySelectorAll('.seg button').forEach(function (b) {
      b.onclick = function (e) { e.stopPropagation(); state.day = parseInt(b.getAttribute('data-day'), 10); render(); };
    });
    d.querySelectorAll('.rate button').forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        var n = parseInt(b.getAttribute('data-n'), 10);
        if (state.ratings[s.id] && state.ratings[s.id].n === n) delete state.ratings[s.id];
        else state.ratings[s.id] = { n: n, cat: s.cat };
        lsSet('ps:rate', state.ratings);
        render();
        var el = document.getElementById('card-' + s.id.replace('/', '-'));
        if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
      };
    });
    var pb = d.querySelector('#photoBtn');
    if (pb) pb.onclick = function (e) { e.stopPropagation(); loadPhotos(s); };
    var kb = d.querySelector('#keyBtn');
    if (kb) kb.onclick = function (e) { e.stopPropagation(); $('flHelp').textContent = ''; openSettings(); };
    var sb = d.querySelector('#saveBtn');
    sb.onclick = function (e) {
      e.stopPropagation();
      if (state.saved[s.id]) delete state.saved[s.id];
      else state.saved[s.id] = { id: s.id, name: s.name, cat: s.cat, lat: s.lat, lon: s.lon, info: s.info };
      lsSet('ps:saved', state.saved);
      buildFilters(); render(); drawMap();
    };
    var del = d.querySelector('#delBtn');
    if (del) del.onclick = function (e) {
      e.stopPropagation();
      if (!del.getAttribute('data-sure')) { del.setAttribute('data-sure', '1'); del.textContent = 'Tap again to delete'; return; }
      delete state.mine[s.id]; delete state.saved[s.id]; delete state.notes[s.id];
      lsSet('ps:mine', state.mine); lsSet('ps:saved', state.saved); lsSet('ps:notes', state.notes);
      state.selected = null; buildFilters(); render(); drawMap();
    };
    return d;
  }

  function select(id, fromList) {
    state.selected = id;
    render();
    var s = visibleSpots().filter(function (x) { return x.id === id; })[0];
    if (s && state.map) {
      state.map.setView([s.lat, s.lon], Math.max(state.map.getZoom(), 14));
      highlightMarkers();
    }
    if (id && fromList) {
      var el = document.getElementById('card-' + id.replace('/', '-'));
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  /* ---------- map ---------- */
  var CAT_COLORS = {
    beach: '#d99a2b', pier: '#2a8bb8', viewpoint: '#7a5bc4', lighthouse: '#c4552b', art: '#c43f8a',
    bridge: '#5a6b7b', historic: '#8c6a3f', nature: '#3d9a55', garden: '#74a82f', park: '#2f8f6b', other: '#444444'
  };

  function initMap() {
    if (state.map || typeof L === 'undefined') return;
    state.map = L.map('map', { zoomControl: true }).setView([state.pos.lat, state.pos.lon], 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(state.map);
    state.map.on('click', function (e) {
      if (!state.picking) return;
      state.picking = false;
      $('pickBanner').hidden = true;
      state.draft.lat = e.latlng.lat; state.draft.lon = e.latlng.lng; state.draft.picked = true;
      openAdd(true);
    });
  }

  function drawMap() {
    if (!state.pos) return;
    initMap();
    if (!state.map) return;
    Object.keys(state.markers).forEach(function (k) { state.map.removeLayer(state.markers[k]); });
    state.markers = {};
    if (state.meMarker) state.map.removeLayer(state.meMarker);
    state.meMarker = L.circleMarker([state.pos.lat, state.pos.lon], {
      radius: 7, color: '#fff', weight: 2, fillColor: '#1a73e8', fillOpacity: 1
    }).addTo(state.map);
    var pts = [[state.pos.lat, state.pos.lon]];
    visibleSpots().forEach(function (s) {
      var m = L.circleMarker([s.lat, s.lon], {
        radius: 7, color: s.mine ? '#000' : '#fff', weight: s.mine ? 2 : 1.5, fillColor: CAT_COLORS[s.cat], fillOpacity: 0.95
      }).addTo(state.map);
      m.on('click', function () { if (!state.picking) select(s.id, true); });
      m.bindTooltip(s.name);
      state.markers[s.id] = m;
      pts.push([s.lat, s.lon]);
    });
    if (pts.length > 1 && !state.selected) {
      try { state.map.fitBounds(pts, { padding: [30, 30], maxZoom: 14 }); } catch (e) {}
    }
    highlightMarkers();
    setTimeout(function () { state.map.invalidateSize(); }, 50);
  }

  function highlightMarkers() {
    Object.keys(state.markers).forEach(function (id) {
      var sel = id === state.selected;
      state.markers[id].setStyle({ radius: sel ? 11 : 7, weight: sel ? 3 : 1.5 });
      if (sel) state.markers[id].bringToFront();
    });
  }

  /* ---------- view switch (cover screen) ---------- */
  function setView(v) {
    state.view = v;
    document.body.setAttribute('data-view', v);
    $('tabList').classList.toggle('on', v === 'list');
    $('tabMap').classList.toggle('on', v === 'map');
    if (v === 'map' && state.map) setTimeout(function () { state.map.invalidateSize(); }, 50);
  }

  /* ---------- add my own spot ---------- */
  function openAdd(keep) {
    if (!state.pos) { showMessage('Turn on location first, then add a spot.', true); return; }
    if (!keep || !state.draft) state.draft = { lat: state.pos.lat, lon: state.pos.lon, name: '', cat: 'other', notes: '', picked: false };
    var f = state.draft;
    $('addName').value = f.name; $('addCat').value = f.cat; $('addNotes').value = f.notes;
    $('addWhere').textContent = f.picked ? 'Pin dropped on the map.' : 'Using where you are right now.';
    $('addModal').hidden = false;
    setTimeout(function () { $('addName').focus(); }, 50);
  }

  function readDraft() {
    state.draft.name = $('addName').value; state.draft.cat = $('addCat').value; state.draft.notes = $('addNotes').value;
  }

  function saveAdd() {
    readDraft();
    var f = state.draft;
    var name = f.name.trim();
    if (!name) { $('addName').focus(); $('addName').classList.add('bad'); return; }
    var id = 'mine/' + Date.now();
    state.mine[id] = { id: id, name: name, cat: f.cat, lat: f.lat, lon: f.lon };
    lsSet('ps:mine', state.mine);
    if (f.notes.trim()) { state.notes[id] = f.notes.trim(); lsSet('ps:notes', state.notes); }
    $('addModal').hidden = true; state.draft = null;
    buildFilters(); render(); drawMap();
    setStatus('Added "' + name + '".');
  }

  function fillCatSelect() {
    var sel = $('addCat'); sel.innerHTML = '';
    ['other'].concat(CAT_ORDER.filter(function (c) { return c !== 'other'; })).forEach(function (c) {
      var o = document.createElement('option'); o.value = c; o.textContent = CATS[c].label; sel.appendChild(o);
    });
  }

  /* ---------- settings ---------- */
  function openSettings() {
    $('flKey').value = state.flickrKey;
    $('settingsModal').hidden = false;
  }

  /* ---------- start ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    var sel = $('radius');
    sel.value = String(state.miles);
    sel.onchange = function () {
      state.miles = parseInt(sel.value, 10);
      lsSet('ps:miles', state.miles);
      if (state.pos) loadSpots();
    };
    var sortSel = $('sort');
    sortSel.onchange = function () {
      if (sortSel.value === 'popular' && !state.flickrKey) {
        sortSel.value = state.sort;
        openSettings();
        $('flHelp').textContent = 'To sort by most photographed, add a free Flickr key first.';
        return;
      }
      state.sort = sortSel.value;
      if (state.sort === 'popular') loadFlickr();
      state.selected = null; render(); drawMap();
    };
    $('retry').onclick = function () { hideMessage(); state.pos ? loadSpots(true) : getLocation(); };
    $('refresh').onclick = function () { if (state.pos) { loadWeather(); loadSpots(true); } };
    $('tabList').onclick = function () { setView('list'); };
    $('tabMap').onclick = function () { setView('map'); };

    fillCatSelect();
    $('addBtn').onclick = function () { openAdd(false); };
    $('addCancel').onclick = function () { $('addModal').hidden = true; state.draft = null; };
    $('addSave').onclick = saveAdd;
    $('addName').oninput = function () { $('addName').classList.remove('bad'); };
    $('addPick').onclick = function () {
      readDraft();
      $('addModal').hidden = true;
      state.picking = true;
      $('pickBanner').hidden = false;
      setView('map');
      if (state.map) { state.map.setView([state.pos.lat, state.pos.lon], 15); setTimeout(function () { state.map.invalidateSize(); }, 80); }
    };
    $('pickCancel').onclick = function () { state.picking = false; $('pickBanner').hidden = true; openAdd(true); };

    $('settingsBtn').onclick = function () { $('flHelp').textContent = ''; openSettings(); };
    $('flClose').onclick = function () { $('settingsModal').hidden = true; };
    $('flSave').onclick = function () {
      state.flickrKey = $('flKey').value.trim();
      lsSet('ps:flkey', state.flickrKey);
      $('settingsModal').hidden = true;
      if (!state.flickrKey) {
        if (state.sort === 'popular') { state.sort = 'best'; $('sort').value = 'best'; }
      } else loadFlickr();
      render();
    };

    /* When you come back to the app, refresh the times so "right now" is really right now. */
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && state.pos) { renderLightBar(); safeRender(); }
    });

    setView('list');
    getLocation();
    if ('serviceWorker' in navigator && /^(https:|http:\/\/localhost)/.test(location.href)) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  });
})();
}
