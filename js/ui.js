/* jshint esversion:11, loopfunc:true, -W014 */

var DAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function setStatus(msg) { document.getElementById('status').textContent = msg; }

function timeToY(h, m) {
  m = m || 0;
  return ((h - CONFIG.DISPLAY_START_H) + m / 60) * CONFIG.HOUR_HEIGHT;
}

function fmtTime(date) {
  return date.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
}

function pad(n) { return String(n).padStart(2, '0'); }
function localDateKey(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}


function getEventColor(ev) {
  var title = (ev.summary || '').toLowerCase();
  for (var i = 0; i < CONFIG.KEYWORD_COLORS.length; i++) {
    if (title.includes(CONFIG.KEYWORD_COLORS[i].keyword.toLowerCase()))
      return CONFIG.KEYWORD_COLORS[i].color;
  }
  return CONFIG.COLORS.busy;
}
function getFreeColor(durMin) {
  if (durMin >= 150) return CONFIG.COLORS.free_long;
  if (durMin >= 120) return CONFIG.COLORS.free_medium;
  return CONFIG.COLORS.free_short;
}

// ─── Render semaine ────────────────────────────────────────────────────────────
function renderWeek(weekStart, events) {
  var totalH  = (CONFIG.DISPLAY_END_H - CONFIG.DISPLAY_START_H) * CONFIG.HOUR_HEIGHT;
  var coreTop = (CONFIG.CORE_START_H  - CONFIG.DISPLAY_START_H) * CONFIG.HOUR_HEIGHT;
  var coreBot = (CONFIG.CORE_END_H    - CONFIG.DISPLAY_START_H) * CONFIG.HOUR_HEIGHT;

  var weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  document.getElementById('week-label').textContent =
    weekStart.toLocaleDateString('fr-BE', { day: 'numeric', month: 'long' }) + ' – ' +
    weekEnd.toLocaleDateString('fr-BE',   { day: 'numeric', month: 'long', year: 'numeric' });

  // Time gutter
var gutterHTML =
  '<div class="gutter-spacer"></div>' +
  '<div class="gutter-body" style="height:' + totalH + 'px">';
for (var h = CONFIG.DISPLAY_START_H; h <= CONFIG.DISPLAY_END_H; h++) {
  gutterHTML += '<div class="time-label" style="top:' + timeToY(h) + 'px">' + pad(h) + ':00</div>';
}
gutterHTML += '</div>';
function getFreeColor(durMin) {
  if (durMin >= 150) return CONFIG.COLORS.free_long;    // >= 2h30
  if (durMin >= 120) return CONFIG.COLORS.free_medium;  // 2h00 - 2h29
  return CONFIG.COLORS.free_short;                      // < 2h
}

  // Day columns
  var daysHTML = '';
  for (var d = 0; d < 7; d++) {
    var day     = new Date(weekStart);
    day.setDate(day.getDate() + d);
    var dayKey    = localDateKey(day);
    var isWeekend = d >= 5;
    var isToday   = dayKey === localDateKey(new Date());

    var dayEvents = events.filter(function(ev) {
      if (!ev.start || !ev.start.dateTime) return false;
      return localDateKey(new Date(ev.start.dateTime)) === dayKey;
    });

    var freeSlots = computeFreeSlots(day, dayEvents);

    var colClass  = 'day-col' + (isWeekend ? ' weekend' : '') + (isToday ? ' today-col' : '');
    var hdrClass  = 'day-header' + (isToday ? ' today-header' : '');
    var numClass  = 'day-num'    + (isToday ? ' today-num'    : '');

    var freeSlotsHTML  = freeSlots.map(function(pair) { return buildFreeBlock(pair[0], pair[1], dayKey); }).join('');
    var eventsHTML     = dayEvents.map(function(ev)   { return buildEventBlock(ev); }).join('');
    var extLabelTop    = coreTop > 30 ? '<span class="ext-label">Etendu</span>' : '';
    var extLabelBot    = (totalH - coreBot) > 30 ? '<span class="ext-label">Etendu</span>' : '';

    daysHTML +=
      '<div class="' + colClass + '" data-date="' + dayKey + '">' +
        '<div class="' + hdrClass + '">' +
          '<span class="day-name">' + DAY_SHORT[d] + '</span>' +
          '<span class="' + numClass + '">' + day.getDate() + '</span>' +
        '</div>' +
        '<div class="day-body" data-date="' + dayKey + '" style="height:' + totalH + 'px">' +
          buildHourLines() +
          '<div class="extended-zone top-zone" style="height:' + coreTop + 'px;background:' + CONFIG.COLORS.extended + '">' + extLabelTop + '</div>' +
          '<div class="extended-zone bot-zone" style="top:' + coreBot + 'px;height:' + (totalH - coreBot) + 'px;background:' + CONFIG.COLORS.extended + '">' + extLabelBot + '</div>' +
          '<div class="core-border" style="top:' + coreTop + 'px"></div>' +
          '<div class="core-border" style="top:' + coreBot + 'px"></div>' +
          freeSlotsHTML +
          eventsHTML +
          buildNowLine(day) +
        '</div>' +
      '</div>';
  }

  document.getElementById('calendar-grid').innerHTML =
    '<div class="time-gutter">' + gutterHTML + '</div>' +
    '<div class="days-container">' + daysHTML + '</div>';

  attachGridListeners();
}

function buildHourLines() {
  var total = CONFIG.DISPLAY_END_H - CONFIG.DISPLAY_START_H;
  var html  = '';
  for (var i = 0; i <= total; i++) {
    html += '<div class="hour-line" style="top:' + (i * CONFIG.HOUR_HEIGHT) + 'px"></div>';
    if (i < total)
      html += '<div class="half-line" style="top:' + (i * CONFIG.HOUR_HEIGHT + CONFIG.HOUR_HEIGHT / 2) + 'px"></div>';
  }
  return html;
}

function buildNowLine(day) {
  var now = new Date();
  if (localDateKey(now) !== localDateKey(day)) return '';
  if (now.getHours() < CONFIG.DISPLAY_START_H || now.getHours() >= CONFIG.DISPLAY_END_H) return '';
  var y = timeToY(now.getHours(), now.getMinutes());
  return '<div class="now-line" style="top:' + y + 'px"><div class="now-dot"></div></div>';
}

function buildFreeBlock(s, e, dayKey) {
  var top    = timeToY(s.getHours(), s.getMinutes());
  var height = timeToY(e.getHours(), e.getMinutes()) - top;
  if (height < 4) return '';
  var durMin  = Math.round((e - s) / 60000);
  var color = getFreeColor(durMin);
  var startDT = dayKey + 'T' + pad(s.getHours()) + ':' + pad(s.getMinutes());
  var endDT   = dayKey + 'T' + pad(e.getHours()) + ':' + pad(e.getMinutes());
  var durStr  = durMin >= 60
    ? Math.floor(durMin/60) + 'h' + (durMin%60 ? pad(durMin%60) : '')
    : durMin + 'min';
  var label   = height > 22 ?
    '<span class="slot-label">' + fmtTime(s) + ' - ' + fmtTime(e) + ' (' + durStr + ')</span>' :
    '';
  return '<div class="free-slot"' +
    ' style="top:' + top + 'px;height:' + height + 'px;background:' + color + '"' +
    ' data-start="' + startDT + '" data-end="' + endDT + '"' +
    ' title="Libre: ' + fmtTime(s) + ' - ' + fmtTime(e) + ' (' + durMin + ' min)">' +
    label + '</div>';
}


function buildEventBlock(ev) {
  var s    = new Date(ev.start.dateTime);
  var e    = new Date(ev.end.dateTime);
  var dS   = CONFIG.DISPLAY_START_H;
  var dE   = CONFIG.DISPLAY_END_H;
  var sMin = s.getHours() * 60 + s.getMinutes();
  var eMin = e.getHours() * 60 + e.getMinutes();
  if (eMin <= dS * 60 || sMin >= dE * 60) return '';
  var clampS = Math.max(sMin, dS * 60);
  var clampE = Math.min(eMin, dE * 60);
  var top    = (clampS - dS * 60) / 60 * CONFIG.HOUR_HEIGHT;
  var height = Math.max((clampE - clampS) / 60 * CONFIG.HOUR_HEIGHT, 20);
  var color  = getEventColor(ev);
  var title  = (ev.summary || '(sans titre)').replace(/"/g, '&quot;');
  var timeEl = height > 34
    ? '<div class="ev-time">' + fmtTime(s) + ' - ' + fmtTime(e) + '</div>'
    : '';
  return '<div class="event-block"' +
    ' style="top:' + top + 'px;height:' + height + 'px;background:' + color + '"' +
    ' data-evid="' + ev.id + '"' +
    ' title="' + title + '">' +
    '<div class="ev-title">' + title + '</div>' +
    timeEl +
    '</div>';
}

// ─── Calcul créneaux libres ────────────────────────────────────────────────────
function computeFreeSlots(day, dayEvents) {
  var coreS = new Date(day); coreS.setHours(CONFIG.CORE_START_H, 0, 0, 0);
  var coreE = new Date(day); coreE.setHours(CONFIG.CORE_END_H,   0, 0, 0);
  var minMs = CONFIG.MIN_FREE_MINUTES * 60000;

  var busy = dayEvents
    .filter(function(ev) { return ev.start && ev.start.dateTime; })
    .map(function(ev) { return [new Date(ev.start.dateTime), new Date(ev.end.dateTime)]; })
    .filter(function(pair) { return pair[1] > coreS && pair[0] < coreE; })
    .map(function(pair) {
      return [Math.max(pair[0].getTime(), coreS.getTime()), Math.min(pair[1].getTime(), coreE.getTime())];
    })
    .sort(function(a, b) { return a[0] - b[0]; });

  var merged = [];
  for (var i = 0; i < busy.length; i++) {
    var cur = busy[i];
    if (merged.length && cur[0] <= merged[merged.length - 1][1])
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], cur[1]);
    else
      merged.push([cur[0], cur[1]]);
  }

  var free   = [];
  var cursor = coreS.getTime();
  for (var j = 0; j < merged.length; j++) {
    if (merged[j][0] - cursor >= minMs)
      free.push([new Date(cursor), new Date(merged[j][0])]);
    cursor = Math.max(cursor, merged[j][1]);
  }
  if (coreE.getTime() - cursor >= minMs)
    free.push([new Date(cursor), coreE]);
  return free;
}

// ─── Listeners ────────────────────────────────────────────────────────────────
function attachGridListeners() {
  document.querySelectorAll('.free-slot').forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.stopPropagation();
      openCreateModal(el.dataset.start, el.dataset.end);
    });
  });

  document.querySelectorAll('.event-block').forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.stopPropagation();
      openEventModal(el.dataset.evid);
    });
  });

  document.querySelectorAll('.day-body').forEach(function(el) {
    el.addEventListener('click', function(e) {
      if (e.target.closest('.event-block') || e.target.closest('.free-slot')) return;
      var rect = el.getBoundingClientRect();
      var hDec = CONFIG.DISPLAY_START_H + (e.clientY - rect.top) / CONFIG.HOUR_HEIGHT;
      var hh   = Math.floor(hDec);
      var mm   = Math.floor((hDec - hh) * 60 / 15) * 15;
      var date = el.dataset.date;
      openCreateModal(date + 'T' + pad(hh) + ':' + pad(mm), date + 'T' + pad(hh + 1) + ':' + pad(mm));
    });
  });
}

// ─── Modals ───────────────────────────────────────────────────────────────────
function openCreateModal(startDT, endDT) {
  document.getElementById('ev-title').value = '';
  document.getElementById('ev-start').value = startDT;
  document.getElementById('ev-end').value   = endDT;
  showModal('modal-create');
  setTimeout(function() { document.getElementById('ev-title').focus(); }, 50);
}

function openEventModal(evId) {
  var ev = allEvents.find(function(e) { return e.id === evId; });
  if (!ev) return;
  pendingEvent = ev;
  var s = new Date(ev.start.dateTime);
  var e = new Date(ev.end.dateTime);
  document.getElementById('modal-ev-title').textContent = ev.summary || '(sans titre)';
  document.getElementById('modal-ev-color').style.background = getEventColor(ev);
  document.getElementById('modal-ev-time').textContent =
    s.toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' }) +
    ' · ' + fmtTime(s) + ' – ' + fmtTime(e);
  showModal('modal-event');
}

function showModal(id) {
  document.getElementById(id).style.display              = 'flex';
  document.getElementById('modal-overlay').style.display = 'block';
}

function closeModal(id) {
  document.getElementById(id).style.display              = 'none';
  document.getElementById('modal-overlay').style.display = 'none';
  pendingEvent = null;
}

function closeAllModals() {
  closeModal('modal-create');
  closeModal('modal-event');
}

async function createEventFromModal() {
  var title = document.getElementById('ev-title').value.trim();
  var start = document.getElementById('ev-start').value;
  var end   = document.getElementById('ev-end').value;
  if (!title)         { alert('Entrez un titre.');    return; }
  if (!start || !end) { alert('Dates manquantes.');   return; }
  if (start >= end)   { alert('Fin avant le début.'); return; }
  closeModal('modal-create');
  await createEvent(title, new Date(start).toISOString(), new Date(end).toISOString());
}

async function deleteEventFromModal() {
  if (!pendingEvent) return;
  if (!confirm('Supprimer "' + (pendingEvent.summary || '(sans titre)') + '" ?')) return;
  var id = pendingEvent.id;
  closeModal('modal-event');
  await deleteEvent(id);
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function toggleSettings() {
  var p = document.getElementById('settings-panel');
  p.style.display = p.style.display === 'none' ? 'block' : 'none';
  if (p.style.display === 'block') renderKeywordRules();
}

function updateColor(key, val) {
  CONFIG.COLORS[key] = val;
  saveConfig();
  if (currentWeekStart) renderWeek(currentWeekStart, allEvents);
}

function renderKeywordRules() {
  var c = document.getElementById('keyword-list');
  c.innerHTML = '';
  if (!CONFIG.KEYWORD_COLORS.length) {
    c.innerHTML = '<span class="no-rules">Aucune règle.</span>';
    return;
  }
  CONFIG.KEYWORD_COLORS.forEach(function(r, i) {
    var row       = document.createElement('div');
    row.className = 'kw-rule';
    var col       = document.createElement('input');
    col.type      = 'color';
    col.value     = r.color;
    col.addEventListener('input', function() {
      CONFIG.KEYWORD_COLORS[i].color = this.value;
      saveConfig();
      if (currentWeekStart) renderWeek(currentWeekStart, allEvents);
    });
    var tag         = document.createElement('span');
    tag.className   = 'kw-tag';
    tag.textContent = r.keyword;
    var del         = document.createElement('button');
    del.className   = 'kw-del';
    del.textContent = 'x';
    del.addEventListener('click', function() { removeKw(i); });
    row.appendChild(col);
    row.appendChild(tag);
    row.appendChild(del);
    c.appendChild(row);
  });
}

function addKw() {
  var kw    = document.getElementById('new-kw').value.trim();
  var color = document.getElementById('new-kw-color').value;
  if (!kw) return;
  CONFIG.KEYWORD_COLORS.push({ keyword: kw, color: color });
  document.getElementById('new-kw').value = '';
  saveConfig();
  renderKeywordRules();
  if (currentWeekStart) renderWeek(currentWeekStart, allEvents);
}

function removeKw(i) {
  CONFIG.KEYWORD_COLORS.splice(i, 1);
  saveConfig();
  renderKeywordRules();
  if (currentWeekStart) renderWeek(currentWeekStart, allEvents);
}