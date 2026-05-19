// --- State ---
const state = {
  gscConnected: false,
  ga4Connected: false,
  ahrefsKey: localStorage.getItem('ahrefs_key') || '',
  winchPdf: null,
  sistrixPdf: null,
};

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
  checkGoogleAuth();
  initAhrefs();
  initPdfUploads();
  initSettings();
  document.getElementById('analyze-btn').addEventListener('click', runAnalysis);
  document.getElementById('copy-btn').addEventListener('click', copyText);
});

// --- Settings panel ---
function initSettings() {
  document.getElementById('settings-toggle').addEventListener('click', () => {
    document.getElementById('settings-panel').classList.toggle('hidden');
  });

  document.getElementById('gsc-connect').addEventListener('click', () => {
    window.location.href = '/api/auth/google?type=gsc';
  });

  document.getElementById('ga4-connect').addEventListener('click', () => {
    window.location.href = '/api/auth/google?type=ga4';
  });

  document.getElementById('ahrefs-save').addEventListener('click', saveAhrefsKey);
}

// --- Google OAuth ---
function checkGoogleAuth() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const refresh = params.get('refresh');

  if (params.get('gsc') === 'ok' && token) {
    localStorage.setItem('gsc_token', token);
    if (refresh) localStorage.setItem('gsc_refresh', refresh);
    state.gscConnected = true;
    history.replaceState({}, '', '/');
  }
  if (params.get('ga4') === 'ok' && token) {
    localStorage.setItem('ga4_token', token);
    if (refresh) localStorage.setItem('ga4_refresh', refresh);
    state.ga4Connected = true;
    history.replaceState({}, '', '/');
  }

  if (localStorage.getItem('gsc_token')) state.gscConnected = true;
  if (localStorage.getItem('ga4_token')) state.ga4Connected = true;

  updateConnectionUI('gsc', state.gscConnected);
  updateConnectionUI('ga4', state.ga4Connected);
}

function updateConnectionUI(type, connected) {
  const status = document.getElementById(`${type}-status`);
  const action = document.getElementById(`${type}-action`);
  const config = document.getElementById(`${type}-config`);

  if (connected) {
    status.textContent = 'Ansluten';
    status.classList.add('connected');
    if (action) action.innerHTML = '<span class="tag tag-online">Ansluten</span>';
    if (config) config.classList.remove('hidden');
    document.getElementById(`${type}-connect`).textContent = 'Återanslut';
  }
}

// --- Ahrefs ---
function initAhrefs() {
  if (state.ahrefsKey) {
    document.getElementById('ahrefs-key').value = state.ahrefsKey;
    document.getElementById('ahrefs-status').textContent = 'Ansluten';
    document.getElementById('ahrefs-status').classList.add('connected');
    document.getElementById('ahrefs-action').innerHTML = '<span class="tag tag-online">Ansluten</span>';
    document.getElementById('ahrefs-config').classList.remove('hidden');
  }
}

function saveAhrefsKey() {
  const key = document.getElementById('ahrefs-key').value.trim();
  if (!key) return;
  localStorage.setItem('ahrefs_key', key);
  state.ahrefsKey = key;
  document.getElementById('ahrefs-status').textContent = 'Ansluten';
  document.getElementById('ahrefs-status').classList.add('connected');
  document.getElementById('ahrefs-action').innerHTML = '<span class="tag tag-online">Ansluten</span>';
  document.getElementById('ahrefs-config').classList.remove('hidden');
  document.getElementById('settings-panel').classList.add('hidden');
}

// --- PDF uploads ---
function initPdfUploads() {
  document.getElementById('wincher-pdf').addEventListener('change', (e) => handlePdf(e, 'wincher'));
  document.getElementById('sistrix-pdf').addEventListener('change', (e) => handlePdf(e, 'sistrix'));
}

async function handlePdf(e, source) {
  const file = e.target.files[0];
  if (!file) return;

  const info = document.getElementById(`${source}-file-info`);
  info.textContent = `Läser ${file.name}...`;
  info.classList.remove('hidden');

  try {
    const text = await extractPdfText(file);
    if (source === 'wincher') state.winchPdf = text;
    else state.sistrixPdf = text;
    info.textContent = file.name;
  } catch (err) {
    info.textContent = 'Kunde inte läsa filen.';
    console.error(err);
  }
}

async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map(item => item.str).join(' '));
  }
  return pages.join('\n');
}

// --- Fetch GSC data ---
async function fetchGscData() {
  const site = document.getElementById('gsc-site').value.trim();
  const period = document.getElementById('current-period').value;
  if (!site || !period) return null;

  const res = await fetch('/api/gsc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ site, period, token: localStorage.getItem('gsc_token') }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return JSON.stringify(data, null, 2);
}

// --- Fetch GA4 data ---
async function fetchGa4Data() {
  const propertyId = document.getElementById('ga4-property').value.trim();
  const period = document.getElementById('current-period').value;
  if (!propertyId || !period) return null;

  const res = await fetch('/api/ga4', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ propertyId, period, token: localStorage.getItem('ga4_token') }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return JSON.stringify(data, null, 2);
}

// --- Fetch Ahrefs data ---
async function fetchAhrefsData() {
  const domain = document.getElementById('ahrefs-domain').value.trim();
  if (!domain || !state.ahrefsKey) return null;

  const res = await fetch('/api/ahrefs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain, apiKey: state.ahrefsKey }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return JSON.stringify(data, null, 2);
}

// --- Main analysis ---
async function runAnalysis() {
  const client = document.getElementById('client-name').value.trim();
  const language = document.getElementById('language').value;
  const period = document.getElementById('current-period').value;
  const compareWith = document.getElementById('compare-with').value;

  if (!client) { alert('Fyll i kundnamn.'); return; }
  if (!period) { alert('Välj aktuell period.'); return; }

  const btn = document.getElementById('analyze-btn');
  btn.disabled = true;
  btn.textContent = 'Hämtar data...';
  document.getElementById('result-card').classList.add('hidden');

  try {
    // Fetch all data in parallel
    const [gscRaw, ga4Raw, ahrefsRaw] = await Promise.all([
      state.gscConnected ? fetchGscData() : Promise.resolve(null),
      state.ga4Connected ? fetchGa4Data() : Promise.resolve(null),
      state.ahrefsKey ? fetchAhrefsData() : Promise.resolve(null),
    ]);

    const data = {
      gsc: gscRaw,
      ga4: ga4Raw,
      ahrefs: ahrefsRaw,
      wincher: state.winchPdf,
      sistrix: state.sistrixPdf,
    };

    const hasData = Object.values(data).some(v => v);
    if (!hasData) {
      alert('Anslut minst en datakälla eller ladda upp en PDF-fil.');
      return;
    }

    btn.textContent = 'Analyserar...';

    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client, language, period, compareWith, data }),
    });

    if (!res.ok) throw new Error('Serverfel');
    const result = await res.json();

    document.getElementById('analysis-output').textContent = result.analysis;
    document.getElementById('result-card').classList.remove('hidden');
    document.getElementById('result-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    alert('Något gick fel. Försök igen.');
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Analysera data';
  }
}

// --- Copy ---
function copyText() {
  const text = document.getElementById('analysis-output').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copy-btn');
    btn.textContent = 'Kopierad!';
    setTimeout(() => (btn.textContent = 'Kopiera text'), 2000);
  });
}
