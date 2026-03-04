/* jshint esversion:11, loopfunc:true, -W014 */

let currentWeekStart = null;
let allEvents        = [];
let pendingEvent     = null;
let slotQueues       = { medium: [], long: [], mediumIdx: 0, longIdx: 0 };

function getMonday(date) {
  const d   = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}

function prevWeek() { currentWeekStart.setDate(currentWeekStart.getDate() - 7); loadWeek(); }
function nextWeek() { currentWeekStart.setDate(currentWeekStart.getDate() + 7); loadWeek(); }
function goToday()  { currentWeekStart = getMonday(new Date()); loadWeek(); }

async function loadWeek() {
  if (!currentWeekStart) currentWeekStart = getMonday(new Date());

  // Plage ajustée pour tirer de 1 mois avant à 6 mois après
  const tMin = new Date(currentWeekStart); tMin.setMonth(tMin.getMonth() - 1);
  const tMax = new Date(currentWeekStart); tMax.setMonth(tMax.getMonth() + 6);
  setStatus('Chargement…');

  try {
    const resp = await gapi.client.calendar.events.list({
      calendarId:   CONFIG.CALENDAR_ID,
      timeMin:      tMin.toISOString(),
      timeMax:      tMax.toISOString(),
      singleEvents: true,
      orderBy:      'startTime',
      maxResults:   2500,
    });
    allEvents = resp.result.items || [];
    renderWeek(currentWeekStart, allEvents);
    setStatus(allEvents.length + ' événement(s) chargé(s).');
  } catch (e) {
    setStatus('Erreur : ' + (e.result && e.result.error ? e.result.error.message : e.message));
  }
}


async function createEvent(title, startISO, endISO) {
  try {
    await gapi.client.calendar.events.insert({
      calendarId: CONFIG.CALENDAR_ID,
      resource: {
        summary: title,
        start: { dateTime: startISO, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        end:   { dateTime: endISO,   timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      },
    });
    setStatus('Événement créé ✅');
    await loadWeek();
    buildSlotQueue();
  } catch (e) {
    setStatus('Erreur création : ' + (e.result && e.result.error ? e.result.error.message : e.message));
  }
}

async function deleteEvent(eventId) {
  try {
    await gapi.client.calendar.events.delete({ calendarId: CONFIG.CALENDAR_ID, eventId: eventId });
    setStatus('Événement supprimé 🗑');
    await loadWeek();
    buildSlotQueue();
  } catch (e) {
    setStatus('Erreur suppression : ' + (e.result && e.result.error ? e.result.error.message : e.message));
  }
}
async function buildSlotQueue() {
  const today  = new Date(); today.setHours(0, 0, 0, 0);
  const future = new Date(today); future.setDate(future.getDate() + 84);
  try {
    const resp = await gapi.client.calendar.events.list({
      calendarId:   CONFIG.CALENDAR_ID,
      timeMin:      today.toISOString(),
      timeMax:      future.toISOString(),
      singleEvents: true,
      orderBy:      'startTime',
      maxResults:   2500,
    });
    const events = resp.result.items || [];
    slotQueues.medium    = [];
    slotQueues.long      = [];
    slotQueues.mediumIdx = 0;
    slotQueues.longIdx   = 0;

    for (var d = 0; d < 84; d++) {
      const day     = new Date(today);
      day.setDate(day.getDate() + d);
      const dayKey = localDateKey(day);   // ← remplace day.toISOString().slice(0,10)
const dayEvents = events.filter(function(ev) {
  return ev.start && ev.start.dateTime &&
    localDateKey(new Date(ev.start.dateTime)) === dayKey;  // ← fix
});

      // Selon config : cherche dans core seulement ou aussi dans extended
      const freeSlots = CONFIG.SLOT_INCLUDE_EXTENDED
        ? computeFreeSlotsExtended(day, dayEvents)
        : computeFreeSlots(day, dayEvents);

      freeSlots.forEach(function(pair) {
        const s      = pair[0];
        const e      = pair[1];
        const durMin = Math.round((e - s) / 60000);
        if (durMin >= 120 && durMin < 150) slotQueues.medium.push({ day: new Date(day), s: s, e: e, durMin: durMin });
        if (durMin >= 150)                 slotQueues.long.push(  { day: new Date(day), s: s, e: e, durMin: durMin });
      });
    }
    setStatus(
      allEvents.length + ' événement(s). ' +
      slotQueues.medium.length + ' créneau(x) 2h-2h29, ' +
      slotQueues.long.length   + ' créneau(x) 2h30+.'
    );
  } catch (e) {
    setStatus('Erreur : ' + (e.result && e.result.error ? e.result.error.message : e.message));
  }
}

// Recherche étendue : inclut 8-9h et 17-18h si le créneau y passe assez de temps
function computeFreeSlotsExtended(day, dayEvents) {
  const dispS  = new Date(day); dispS.setHours(CONFIG.DISPLAY_START_H, 0, 0, 0);
  const dispE  = new Date(day); dispE.setHours(CONFIG.DISPLAY_END_H,   0, 0, 0);
  const coreS  = new Date(day); coreS.setHours(CONFIG.CORE_START_H,    0, 0, 0);
  const coreE  = new Date(day); coreE.setHours(CONFIG.CORE_END_H,      0, 0, 0);
  const minMs  = CONFIG.MIN_FREE_MINUTES * 60000;
  const extMin = (CONFIG.SLOT_EXTENDED_MIN || 0) * 60000;

  var busy = dayEvents
    .filter(function(ev) { return ev.start && ev.start.dateTime; })
    .map(function(ev) { return [new Date(ev.start.dateTime), new Date(ev.end.dateTime)]; })
    .filter(function(p) { return p[1] > dispS && p[0] < dispE; })
    .map(function(p) {
      return [Math.max(p[0].getTime(), dispS.getTime()), Math.min(p[1].getTime(), dispE.getTime())];
    })
    .sort(function(a, b) { return a[0] - b[0]; });

  var merged = [];
  for (var i = 0; i < busy.length; i++) {
    var cur = busy[i];
    if (merged.length && cur[0] <= merged[merged.length-1][1])
      merged[merged.length-1][1] = Math.max(merged[merged.length-1][1], cur[1]);
    else merged.push([cur[0], cur[1]]);
  }

  var free   = [];
  var cursor = dispS.getTime();
  for (var j = 0; j < merged.length; j++) {
    if (merged[j][0] - cursor >= minMs) {
      var slotS = new Date(cursor);
      var slotE = new Date(merged[j][0]);
      if (_slotPassesExtendedFilter(slotS, slotE, coreS, coreE, extMin))
        free.push([slotS, slotE]);
    }
    cursor = Math.max(cursor, merged[j][1]);
  }
  if (dispE.getTime() - cursor >= minMs) {
    var slotS2 = new Date(cursor);
    if (_slotPassesExtendedFilter(slotS2, dispE, coreS, coreE, extMin))
      free.push([slotS2, dispE]);
  }
  return free;
}

// Vérifie que le créneau a assez de minutes dans les zones étendues
function _slotPassesExtendedFilter(s, e, coreS, coreE, extMinMs) {
  if (extMinMs <= 0) return true;
  // minutes dans zone étendue = partie avant coreS + partie après coreE
  var extBefore = Math.max(0, Math.min(coreS.getTime(), e.getTime()) - s.getTime());
  var extAfter  = Math.max(0, e.getTime() - Math.max(coreE.getTime(), s.getTime()));
  return (extBefore + extAfter) >= extMinMs;
}

function jumpSlot(type) {
  const queue  = type === 'medium' ? slotQueues.medium : slotQueues.long;
  const idxKey = type === 'medium' ? 'mediumIdx'       : 'longIdx';

  if (!queue.length) {
    setStatus('Aucun créneau de ce type dans les 12 prochaines semaines.');
    return;
  }
  if (slotQueues[idxKey] >= queue.length) {
    slotQueues[idxKey] = 0;
    setStatus('Fin de liste, retour au début.');
  }

  const slot   = queue[slotQueues[idxKey]];
  slotQueues[idxKey]++;
  const durStr = Math.floor(slot.durMin / 60) + 'h' + (slot.durMin % 60 ? pad(slot.durMin % 60) : '');
  setStatus(
    'Créneau ' + slotQueues[idxKey] + '/' + queue.length + ' · ' +
    slot.day.toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' }) +
    ' ' + fmtTime(slot.s) + ' – ' + fmtTime(slot.e) + ' (' + durStr + ')'
  );

  currentWeekStart = getMonday(slot.day);
  loadWeek().then(function() {
const dayKey  = localDateKey(slot.day);   // ← fix
    const startDT = dayKey + 'T' + pad(slot.s.getHours()) + ':' + pad(slot.s.getMinutes());
    const el = document.querySelector('.free-slot[data-start="' + startDT + '"]');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.outline   = '3px solid #FF9800';
      el.style.boxShadow = '0 0 0 4px rgba(255,152,0,.4)';
      el.style.zIndex    = '30';
      setTimeout(function() {
        el.style.outline   = '';
        el.style.boxShadow = '';
        el.style.zIndex    = '';
      }, 2500);
    }
  });
}