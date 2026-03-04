/* jshint esversion:11 */

const SCOPES    = 'https://www.googleapis.com/auth/calendar';
const DISCOVERY = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

let tokenClient;
let gapiReady = false;
let gisReady  = false;

function gapiLoaded() {
  gapi.load('client', async () => {
    await gapi.client.init({ apiKey: CONFIG.API_KEY, discoveryDocs: [DISCOVERY] });
    gapiReady = true;
    _checkReady();
  });
}

function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.CLIENT_ID,
    scope:     SCOPES,
    callback:  async (resp) => {
      if (resp.error) {
        setStatus('Erreur auth : ' + resp.error);
        document.getElementById('btn-auth').style.display    = 'inline-flex';
        document.getElementById('btn-signout').style.display = 'none';
        return;
      }
      document.getElementById('btn-auth').style.display    = 'none';
      document.getElementById('btn-signout').style.display = 'inline-flex';
      localStorage.setItem('agenda_autoreconnect', '1');
      setStatus('Connecté ✅');
      await loadWeek();
      buildSlotQueue();
    },
  });
  gisReady = true;
  _checkReady();
}

function _checkReady() {
  if (!gapiReady || !gisReady) return;
  document.getElementById('btn-auth').disabled = false;
  if (localStorage.getItem('agenda_autoreconnect') === '1') {
    tokenClient.requestAccessToken({ prompt: '' });
  }
}

function handleAuth() {
  tokenClient.requestAccessToken({ prompt: 'consent' });
}

function handleSignout() {
  const t = gapi.client.getToken();
  if (t) { google.accounts.oauth2.revoke(t.access_token); gapi.client.setToken(''); }
  localStorage.removeItem('agenda_autoreconnect');
  document.getElementById('btn-auth').style.display    = 'inline-flex';
  document.getElementById('btn-signout').style.display = 'none';
  document.getElementById('calendar-grid').innerHTML   = '';
  setStatus('Déconnecté.');
}
