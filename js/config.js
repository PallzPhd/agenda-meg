/* jshint esversion:11, loopfunc:true, -W014 */

const DEFAULTS = {
  CLIENT_ID:        '758927584072-1j9bc31vkq1ed4p36vc0j34jq80ktbr3.apps.googleusercontent.com',
  API_KEY:          'AIzaSyDvMdF4ACk5zmTweHpOH8WxGFsjehrKWhA',
  CALENDAR_ID:      'meg.erasme@gmail.com',
  DISPLAY_START_H:  8,
  DISPLAY_END_H:    18,
  CORE_START_H:     9,
  CORE_END_H:       17,
  HOUR_HEIGHT:      80,
  MIN_FREE_MINUTES: 15,
COLORS: {
  free_short:  '#A5D6A7',   // créneaux libres < 2h
  free_medium: '#4CAF50',   // créneaux libres 2h00 – 2h29
  free_long:   '#1B5E20',   // créneaux libres >= 2h30
  busy:        '#1a73e8',   // événements (défaut)
  extended:    '#F0F0F0',   // zones étendues
  currentTime: '#EA4335',
},
  KEYWORD_COLORS: [],
};

const STORAGE_KEY = 'agenda_config_v1';

function loadConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(saved);
    return {
      ...DEFAULTS,
      ...parsed,
      COLORS:         { ...DEFAULTS.COLORS, ...(parsed.COLORS || {}) },
      KEYWORD_COLORS: parsed.KEYWORD_COLORS || [],
      CLIENT_ID:      DEFAULTS.CLIENT_ID,
      API_KEY:        DEFAULTS.API_KEY,
    };
  } catch (e) {
    console.warn('Config corrompue, reset.', e);
    return structuredClone(DEFAULTS);
  }                          // ← } catch
}                            // ← } loadConfig

function saveConfig() {
  const toSave = {
    COLORS:           CONFIG.COLORS,
    KEYWORD_COLORS:   CONFIG.KEYWORD_COLORS,
    HOUR_HEIGHT:      CONFIG.HOUR_HEIGHT,
    MIN_FREE_MINUTES: CONFIG.MIN_FREE_MINUTES,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}                            // ← } saveConfig

function resetConfig() {
  localStorage.removeItem(STORAGE_KEY);
  const fresh = structuredClone(DEFAULTS);
  Object.assign(CONFIG.COLORS, fresh.COLORS);
  CONFIG.KEYWORD_COLORS   = fresh.KEYWORD_COLORS;
  CONFIG.HOUR_HEIGHT      = fresh.HOUR_HEIGHT;
  CONFIG.MIN_FREE_MINUTES = fresh.MIN_FREE_MINUTES;
document.getElementById('col-free-short').value  = CONFIG.COLORS.free_short;
document.getElementById('col-free-medium').value = CONFIG.COLORS.free_medium;
document.getElementById('col-free-long').value   = CONFIG.COLORS.free_long;
document.getElementById('col-busy').value        = CONFIG.COLORS.busy;
document.getElementById('col-extended').value    = CONFIG.COLORS.extended;

  renderKeywordRules();
  if (currentWeekStart) renderWeek(currentWeekStart, allEvents);
}                            // ← } resetConfig

const CONFIG = loadConfig();
