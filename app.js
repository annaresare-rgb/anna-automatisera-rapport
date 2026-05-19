// --- State ---
const state = {
  supabase: null,
  gscConnected: false,
  ga4Connected: false,
  ahrefsKey: localStorage.getItem('ahrefs_key') || '',
  winchPdf: null,
  sistrixPdf: null,
  currentClient: null,
  clients: [],
};

// --- Boot ---
document.addEventListener('DOMContentLoaded', async () => {
  await initSupabase();
  checkGoogleAuth();
  initAhrefs();
  initPdfUploads();
  initSettings();
  initClientSelector();
  initProfileToggle();
  initHistoryToggle();
  document.getElementById('analyze-btn').addEventListener('click', runAnalysis);
  document.getElementById('copy-btn').addEventListener('click', copyText);
  document.getElementById('pdf-btn').addEventListener('click', exportPdf);
});

// --- Supabase ---
async function initSupabase() {
  try {
    state.supabase = supabase.createClient(
      'https://taqwcfvgoeakfufzucyv.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhcXdjZnZnb2Vha2Z1Znp1Y3l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxODI4NTcsImV4cCI6MjA5NDc1ODg1N30.-wp13Z5XmtOfdUve0CbnTJY75q6R_C120pfPKgouMC4'
    );
  } catch (e) {
    console.warn('Supabase ej tillgänglig:', e);
  }
}

// --- Settings ---
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
    if (type === 'gsc') loadGscSites();
  }
}

async function loadGscSites() {
  const select = document.getElementById('gsc-site');
  select.innerHTML = '<option value="">Hämtar sajter...</option>';
  try {
    const res = await fetch('/api/gsc-sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: localStorage.getItem('gsc_token') }),
    });
    const json = await res.json();
    if (!res.ok) { select.innerHTML = `<option value="">Fel: ${json.error}</option>`; return; }
    select.innerHTML = json.sites.map(s => `<option value="${s}">${s}</option>`).join('');

    // Pre-select client's saved site
    if (state.currentClient?.gsc_site) {
      select.value = state.currentClient.gsc_site;
    }
  } catch (err) {
    select.innerHTML = '<option value="">Kunde inte hämta sajter</option>';
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
  initAhrefs();
  document.getElementById('settings-panel').classList.add('hidden');
}

// --- Client selector ---
async function initClientSelector() {
  await loadClients();

  document.getElementById('client-select').addEventListener('change', onClientSelect);
  document.getElementById('new-client-btn').addEventListener('click', () => {
    document.getElementById('client-select').value = '';
    document.getElementById('new-client-row').classList.remove('hidden');
    document.getElementById('client-profile').classList.remove('hidden');
    clearProfile();
    state.currentClient = null;
  });
  document.getElementById('save-profile-btn').addEventListener('click', saveClientProfile);
}

async function loadClients() {
  if (!state.supabase) return;
  try {
    const { data, error } = await state.supabase.from('clients').select('*').order('name');
    if (error) { console.error('loadClients error:', error); return; }
    state.clients = data || [];
    const select = document.getElementById('client-select');
    const current = select.value;
    select.innerHTML = '<option value="">— Välj eller skapa ny —</option>' +
      state.clients.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    if (current) select.value = current;
  } catch (e) { console.error('loadClients exception:', e); }
}

async function onClientSelect() {
  const name = document.getElementById('client-select').value;
  document.getElementById('new-client-row').classList.add('hidden');

  if (!name) {
    document.getElementById('client-profile').classList.add('hidden');
    state.currentClient = null;
    return;
  }

  const client = state.clients.find(c => c.name === name);
  state.currentClient = client;
  document.getElementById('client-profile').classList.remove('hidden');
  fillProfile(client);
  await loadHistory(name);

  // Pre-fill data source fields
  if (client.ga4_property_id) document.getElementById('ga4-property').value = client.ga4_property_id;
  if (client.ahrefs_domain) document.getElementById('ahrefs-domain').value = client.ahrefs_domain;
  if (client.language) document.getElementById('profile-language').value = client.language;
  if (state.gscConnected && client.gsc_site) {
    await loadGscSites();
  }
}

function fillProfile(client) {
  document.getElementById('profile-conversions').value = client.conversions || '';
  document.getElementById('profile-metrics').value = client.important_metrics || '';
  document.getElementById('profile-brand').value = client.brand_keywords || '';
  document.getElementById('profile-notes').value = client.context_notes || '';
  document.getElementById('profile-language').value = client.language || 'sv';
}

function clearProfile() {
  ['profile-conversions', 'profile-metrics', 'profile-brand', 'profile-notes'].forEach(id => {
    document.getElementById(id).value = '';
  });
}

async function saveClientProfile() {
  const name = document.getElementById('client-select').value ||
               document.getElementById('client-name-input').value.trim();
  if (!name) { alert('Ange kundnamn.'); return; }

  const profile = {
    name,
    language: document.getElementById('profile-language').value,
    conversions: document.getElementById('profile-conversions').value,
    important_metrics: document.getElementById('profile-metrics').value,
    brand_keywords: document.getElementById('profile-brand').value,
    context_notes: document.getElementById('profile-notes').value,
    gsc_site: document.getElementById('gsc-site').value || null,
    ga4_property_id: document.getElementById('ga4-property').value || null,
    ahrefs_domain: document.getElementById('ahrefs-domain').value || null,
  };

  const btn = document.getElementById('save-profile-btn');
  btn.textContent = 'Sparar...';
  btn.disabled = true;

  try {
    if (!state.supabase) throw new Error('Ingen databasanslutning');
    const { data, error } = await state.supabase
      .from('clients')
      .upsert({ ...profile, updated_at: new Date().toISOString() }, { onConflict: 'name' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    state.currentClient = data;
    await loadClients();
    document.getElementById('client-select').value = name;
    document.getElementById('new-client-row').classList.add('hidden');
    btn.textContent = 'Sparad!';
    setTimeout(() => { btn.textContent = 'Spara kundprofil'; btn.disabled = false; }, 2000);
  } catch (err) {
    console.error('saveClientProfile error:', err);
    btn.textContent = 'Spara kundprofil';
    btn.disabled = false;
    alert('Kunde inte spara: ' + err.message);
  }
}

// --- Profile toggle ---
function initProfileToggle() {
  document.getElementById('profile-toggle').addEventListener('click', () => {
    document.getElementById('profile-fields').classList.toggle('hidden');
    document.querySelector('#profile-toggle .toggle-arrow').textContent =
      document.getElementById('profile-fields').classList.contains('hidden') ? '▸' : '▾';
  });
}

// --- History ---
function initHistoryToggle() {
  document.getElementById('history-toggle').addEventListener('click', () => {
    document.getElementById('history-list').classList.toggle('hidden');
    document.querySelector('#history-toggle .toggle-arrow').textContent =
      document.getElementById('history-list').classList.contains('hidden') ? '▸' : '▾';
  });
}

async function loadHistory(clientName) {
  if (!clientName || !state.supabase) return;
  try {
    const { data: reports, error } = await state.supabase
      .from('reports')
      .select('id, period, report_format, sources_used, created_at, analysis_text')
      .eq('client_name', clientName)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) return;
    const historyCard = document.getElementById('history-card');
    const historyList = document.getElementById('history-list');

    if (!reports.length) { historyCard.classList.add('hidden'); return; }

    historyCard.classList.remove('hidden');
    historyList.innerHTML = reports.map(r => `
      <div class="history-item" data-id="${r.id}">
        <div class="history-meta">
          <span class="history-period">${r.period}</span>
          <span class="history-format">${formatLabel(r.report_format)}</span>
          <span class="history-sources">${(r.sources_used || []).join(', ')}</span>
        </div>
        <button class="btn-history-view" onclick="showHistoricalReport(${JSON.stringify(r.analysis_text).replace(/"/g, '&quot;')})">Visa</button>
      </div>
    `).join('');
  } catch (e) { console.warn('Kunde inte ladda historik:', e); }
}

function formatLabel(fmt) {
  return { email: 'E-post', presentation: 'Presentation', summary: 'Sammanfattning' }[fmt] || fmt;
}

function showHistoricalReport(text) {
  document.getElementById('analysis-output').textContent = text;
  document.getElementById('result-card').classList.remove('hidden');
  document.getElementById('result-card').scrollIntoView({ behavior: 'smooth' });
}

// --- PDF uploads ---
function initPdfUploads() {
  document.getElementById('wincher-pdf').addEventListener('change', e => handlePdf(e, 'wincher'));
  document.getElementById('sistrix-pdf').addEventListener('change', e => handlePdf(e, 'sistrix'));
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
  } catch {
    info.textContent = 'Kunde inte läsa filen.';
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

// --- Data fetching ---
async function fetchGscData() {
  const site = document.getElementById('gsc-site').value;
  const period = document.getElementById('current-period').value;
  if (!site) return { data: null, error: 'Välj webbplats' };
  if (!period) return { data: null, error: 'Period saknas' };
  try {
    const res = await fetch('/api/gsc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site, period, token: localStorage.getItem('gsc_token') }),
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error || `HTTP ${res.status}` };
    return { data: JSON.stringify(json, null, 2) };
  } catch (err) { return { data: null, error: err.message }; }
}

async function fetchGa4Data() {
  const propertyId = document.getElementById('ga4-property').value.trim();
  const period = document.getElementById('current-period').value;
  if (!propertyId) return { data: null, error: 'Property ID saknas' };
  if (!period) return { data: null, error: 'Period saknas' };
  try {
    const res = await fetch('/api/ga4', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId, period, token: localStorage.getItem('ga4_token') }),
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error || `HTTP ${res.status}` };
    return { data: JSON.stringify(json, null, 2) };
  } catch (err) { return { data: null, error: err.message }; }
}

async function fetchAhrefsData() {
  const domain = document.getElementById('ahrefs-domain').value.trim();
  if (!domain) return { data: null, error: 'Domän saknas' };
  try {
    const res = await fetch('/api/ahrefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, apiKey: state.ahrefsKey }),
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error || `HTTP ${res.status}` };
    return { data: JSON.stringify(json, null, 2) };
  } catch (err) { return { data: null, error: err.message }; }
}

// --- Main analysis ---
async function runAnalysis() {
  const clientName = document.getElementById('client-select').value ||
                     document.getElementById('client-name-input').value.trim();
  const period = document.getElementById('current-period').value;
  const compareWith = document.getElementById('compare-with').value;
  const reportFormat = document.querySelector('input[name="report-format"]:checked').value;
  const language = document.getElementById('profile-language').value;

  if (!clientName) { alert('Välj eller skapa en kund.'); return; }
  if (!period) { alert('Välj period.'); return; }

  const btn = document.getElementById('analyze-btn');
  btn.disabled = true;
  btn.textContent = 'Hämtar data...';
  document.getElementById('result-card').classList.add('hidden');

  try {
    const [gscResult, ga4Result, ahrefsResult] = await Promise.all([
      state.gscConnected ? fetchGscData() : Promise.resolve({ data: null }),
      state.ga4Connected ? fetchGa4Data() : Promise.resolve({ data: null }),
      state.ahrefsKey ? fetchAhrefsData() : Promise.resolve({ data: null }),
    ]);

    const statusLines = [];
    if (state.gscConnected) statusLines.push(gscResult.data ? `✓ Google Search Console` : `✗ Google Search Console: ${gscResult.error}`);
    if (state.ga4Connected) statusLines.push(ga4Result.data ? `✓ Google Analytics 4` : `✗ Google Analytics 4: ${ga4Result.error}`);
    if (state.ahrefsKey) statusLines.push(ahrefsResult.data ? `✓ Ahrefs` : `✗ Ahrefs: ${ahrefsResult.error}`);
    if (state.winchPdf) statusLines.push('✓ Wincher (PDF)');
    if (state.sistrixPdf) statusLines.push('✓ Sistrix (PDF)');

    if (statusLines.some(l => l.startsWith('✗'))) {
      const ok = confirm('En eller flera datakällor kunde inte hämtas:\n\n' + statusLines.join('\n') + '\n\nVill du fortsätta med de som fungerade?');
      if (!ok) return;
    }

    const data = {
      gsc: gscResult.data,
      ga4: ga4Result.data,
      ahrefs: ahrefsResult.data,
      wincher: state.winchPdf,
      sistrix: state.sistrixPdf,
    };

    if (!Object.values(data).some(v => v)) {
      alert('Ingen data tillgänglig. Anslut minst en datakälla.');
      return;
    }

    btn.textContent = 'Analyserar...';

    const clientProfile = {
      conversions: document.getElementById('profile-conversions').value,
      importantMetrics: document.getElementById('profile-metrics').value,
      brandKeywords: document.getElementById('profile-brand').value,
      contextNotes: document.getElementById('profile-notes').value,
    };

    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client: clientName, language, period, compareWith, reportFormat, data, clientProfile }),
    });

    if (!res.ok) throw new Error('Serverfel');
    const result = await res.json();

    document.getElementById('analysis-output').textContent = result.analysis;
    document.getElementById('result-card').classList.remove('hidden');
    document.getElementById('result-card').scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Refresh history
    await loadHistory(clientName);
  } catch (err) {
    alert('Något gick fel. Försök igen.');
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Analysera data';
  }
}

// --- Copy & PDF ---
function copyText() {
  navigator.clipboard.writeText(document.getElementById('analysis-output').textContent).then(() => {
    const btn = document.getElementById('copy-btn');
    btn.textContent = 'Kopierad!';
    setTimeout(() => btn.textContent = 'Kopiera', 2000);
  });
}

function exportPdf() {
  window.print();
}
