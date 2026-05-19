// --- State ---
const state = {
  supabase: null,
  gscConnected: false,
  ga4Connected: false,
  ahrefsKey: localStorage.getItem('ahrefs_key') || '',
  trelloKey: localStorage.getItem('trello_key') || '',
  trelloToken: localStorage.getItem('trello_token') || '',
  winchPdf: null,
  sistrixPdf: null,
  csvFiles: [],       // [{ name, content }]
  currentClient: null,
  clients: [],
};

// --- Boot ---
document.addEventListener('DOMContentLoaded', async () => {
  await initSupabase();
  checkGoogleAuth();
  initAhrefs();
  initTrello();
  initPdfUploads();
  initSettings();
  initClientSelector();
  initProfileToggle();
  initHistoryToggle();
  initSubsectionToggles();
  initCsvUpload();
  document.getElementById('analyze-btn').addEventListener('click', runAnalysis);
  document.getElementById('copy-btn').addEventListener('click', copyText);
  document.getElementById('pdf-btn').addEventListener('click', exportPdf);
});

// --- Token refresh ---
async function refreshGoogleToken(type) {
  const refreshToken = localStorage.getItem(`${type}_refresh`);
  if (!refreshToken) return false;
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const { accessToken } = await res.json();
    localStorage.setItem(`${type}_token`, accessToken);
    return true;
  } catch { return false; }
}

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
  document.getElementById('trello-save').addEventListener('click', saveTrelloCredentials);
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

function initTrello() {
  if (state.trelloKey && state.trelloToken) {
    document.getElementById('trello-key').value = state.trelloKey;
    document.getElementById('trello-token').value = state.trelloToken;
    const status = document.getElementById('trello-status');
    if (status) { status.textContent = 'Ansluten'; status.classList.add('connected'); }
  }
}

function saveTrelloCredentials() {
  const key = document.getElementById('trello-key').value.trim();
  const token = document.getElementById('trello-token').value.trim();
  if (!key || !token) return;
  localStorage.setItem('trello_key', key);
  localStorage.setItem('trello_token', token);
  state.trelloKey = key;
  state.trelloToken = token;
  initTrello();
  document.getElementById('settings-panel').classList.add('hidden');
}

// --- Subsection toggles (Historisk data & Integrationer) ---
function initSubsectionToggles() {
  ['historical', 'integrations'].forEach(id => {
    const toggle = document.getElementById(`${id}-toggle`);
    const fields = document.getElementById(`${id}-fields`);
    if (!toggle || !fields) return;
    toggle.addEventListener('click', () => {
      const open = fields.classList.toggle('hidden');
      toggle.querySelector('.toggle-arrow').textContent = open ? '▸' : '▾';
    });
  });
}

// --- CSV upload ---
function initCsvUpload() {
  document.getElementById('csv-upload-input').addEventListener('change', async (e) => {
    for (const file of Array.from(e.target.files)) {
      const text = await file.text();
      state.csvFiles.push({ name: file.name, content: text });
    }
    renderCsvList();
    e.target.value = '';
  });
}

function renderCsvList() {
  const list = document.getElementById('csv-file-list');
  list.innerHTML = state.csvFiles.map((f, i) => `
    <li class="csv-file-item">
      <span class="csv-file-name">${f.name}</span>
      <button class="csv-remove" onclick="removeCsvFile(${i})">×</button>
    </li>
  `).join('');
}

function removeCsvFile(index) {
  state.csvFiles.splice(index, 1);
  renderCsvList();
}

async function loadGscSites() {
  const searchInput = document.getElementById('gsc-site-search');
  const hiddenInput = document.getElementById('gsc-site');
  const list = document.getElementById('gsc-site-list');
  const wrapper = document.getElementById('gsc-site-wrapper');

  searchInput.value = '';
  searchInput.placeholder = 'Hämtar sajter...';
  searchInput.disabled = true;

  try {
    const res = await fetch('/api/gsc-sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: localStorage.getItem('gsc_token') }),
    });
    const json = await res.json();
    searchInput.disabled = false;
    searchInput.placeholder = 'Sök sajt...';

    if (!res.ok) { searchInput.placeholder = `Fel: ${json.error}`; return; }

    const sites = json.sites;

    function renderList(filter) {
      const matches = filter
        ? sites.filter(s => s.toLowerCase().includes(filter.toLowerCase()))
        : sites;
      if (!matches.length) {
        list.innerHTML = '<li class="no-results">Inga träffar</li>';
      } else {
        list.innerHTML = matches.map(s => `<li data-value="${s}">${s}</li>`).join('');
      }
    }

    // Only attach listeners once (flag on wrapper)
    if (!wrapper._gscInit) {
      wrapper._gscInit = true;

      searchInput.addEventListener('focus', () => {
        renderList(searchInput.value);
        list.classList.add('open');
      });

      searchInput.addEventListener('input', () => {
        hiddenInput.value = '';
        renderList(searchInput.value);
        list.classList.add('open');
      });

      list.addEventListener('mousedown', (e) => {
        const li = e.target.closest('li[data-value]');
        if (!li) return;
        hiddenInput.value = li.dataset.value;
        searchInput.value = li.dataset.value;
        list.classList.remove('open');
      });

      document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) list.classList.remove('open');
      });
    }

    // Pre-select client's saved site
    if (state.currentClient?.gsc_site) {
      hiddenInput.value = state.currentClient.gsc_site;
      searchInput.value = state.currentClient.gsc_site;
    }
  } catch (err) {
    searchInput.disabled = false;
    searchInput.placeholder = 'Kunde inte hämta sajter';
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
  document.getElementById('slack-channel-id').value = client.slack_channel_id || '';
  document.getElementById('slack-bot-token').value = client.slack_bot_token || '';
  document.getElementById('trello-board-id').value = client.trello_board_id || '';
  // Load historical CSV data stored in Supabase
  if (client.historical_data) {
    try {
      state.csvFiles = JSON.parse(client.historical_data);
    } catch { state.csvFiles = []; }
    renderCsvList();
  } else {
    state.csvFiles = [];
    renderCsvList();
  }
}

function clearProfile() {
  ['profile-conversions', 'profile-metrics', 'profile-brand', 'profile-notes',
   'slack-channel-id', 'slack-bot-token', 'trello-board-id'].forEach(id => {
    document.getElementById(id).value = '';
  });
  state.csvFiles = [];
  renderCsvList();
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
    historical_data: state.csvFiles.length ? JSON.stringify(state.csvFiles) : null,
    slack_channel_id: document.getElementById('slack-channel-id').value || null,
    slack_bot_token: document.getElementById('slack-bot-token').value || null,
    trello_board_id: document.getElementById('trello-board-id').value || null,
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
  document.getElementById('analysis-output').innerHTML = marked.parse(text);
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
  const compareWith = document.getElementById('compare-with').value;
  const brandKeywords = document.getElementById('profile-brand').value;
  if (!site) return { data: null, error: 'Välj webbplats' };
  if (!period) return { data: null, error: 'Period saknas' };

  const call = () => fetch('/api/gsc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ site, period, compareWith, brandKeywords, token: localStorage.getItem('gsc_token') }),
  });

  try {
    let res = await call();
    if (res.status === 401) {
      const refreshed = await refreshGoogleToken('gsc');
      if (refreshed) res = await call();
    }
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error || `HTTP ${res.status}` };
    return { data: json.text };
  } catch (err) { return { data: null, error: err.message }; }
}

async function fetchGa4Data() {
  const propertyId = document.getElementById('ga4-property').value.trim();
  const period = document.getElementById('current-period').value;
  const compareWith = document.getElementById('compare-with').value;
  if (!propertyId) return { data: null, error: 'Property ID saknas' };
  if (!period) return { data: null, error: 'Period saknas' };

  const call = () => fetch('/api/ga4', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      propertyId, period, compareWith,
      token: localStorage.getItem('ga4_token'),
      conversionEvents: document.getElementById('profile-conversions').value,
    }),
  });

  try {
    let res = await call();
    if (res.status === 401) {
      const refreshed = await refreshGoogleToken('ga4');
      if (refreshed) res = await call();
    }
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error || `HTTP ${res.status}` };
    return { data: json.text };
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

async function fetchSlackData(channelId, token) {
  try {
    const res = await fetch('/api/slack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId, token }),
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error || `HTTP ${res.status}` };
    return { data: json.text };
  } catch (err) { return { data: null, error: err.message }; }
}


async function fetchTrelloData(boardId, key, token) {
  try {
    const res = await fetch('/api/trello', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boardId, key, token }),
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error || `HTTP ${res.status}` };
    return { data: json.text };
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
    const client = state.currentClient;
    const slackChannel = client?.slack_channel_id;
    const slackToken = client?.slack_bot_token;
    const trelloBoardId = client?.trello_board_id;

    const [gscResult, ga4Result, ahrefsResult, slackResult, trelloResult] = await Promise.all([
      state.gscConnected ? fetchGscData() : Promise.resolve({ data: null }),
      state.ga4Connected ? fetchGa4Data() : Promise.resolve({ data: null }),
      state.ahrefsKey ? fetchAhrefsData() : Promise.resolve({ data: null }),
      slackChannel && slackToken ? fetchSlackData(slackChannel, slackToken) : Promise.resolve({ data: null }),
      trelloBoardId && state.trelloKey && state.trelloToken ? fetchTrelloData(trelloBoardId, state.trelloKey, state.trelloToken) : Promise.resolve({ data: null }),
    ]);

    const statusLines = [];
    if (state.gscConnected) statusLines.push(gscResult.data ? `✓ Google Search Console` : `✗ Google Search Console: ${gscResult.error}`);
    if (state.ga4Connected) statusLines.push(ga4Result.data ? `✓ Google Analytics 4` : `✗ Google Analytics 4: ${ga4Result.error}`);
    if (state.ahrefsKey) statusLines.push(ahrefsResult.data ? `✓ Ahrefs` : `✗ Ahrefs: ${ahrefsResult.error}`);
    if (state.winchPdf) statusLines.push('✓ Wincher (PDF)');
    if (state.sistrixPdf) statusLines.push('✓ Sistrix (PDF)');
    if (slackChannel && slackToken) statusLines.push(slackResult.data ? `✓ Slack` : `✗ Slack: ${slackResult.error}`);
    if (trelloBoardId && state.trelloKey) statusLines.push(trelloResult.data ? `✓ Trello` : `✗ Trello: ${trelloResult.error}`);
    if (state.csvFiles.length) statusLines.push(`✓ Historisk data (${state.csvFiles.length} fil${state.csvFiles.length > 1 ? 'er' : ''})`);

    if (statusLines.some(l => l.startsWith('✗'))) {
      const ok = confirm('En eller flera datakällor kunde inte hämtas:\n\n' + statusLines.join('\n') + '\n\nVill du fortsätta med de som fungerade?');
      if (!ok) return;
    }

    const historicalText = state.csvFiles.length
      ? state.csvFiles.map(f => `### ${f.name}\n${f.content.slice(0, 3000)}`).join('\n\n')
      : null;

    const data = {
      gsc: gscResult.data,
      ga4: ga4Result.data,
      ahrefs: ahrefsResult.data,
      wincher: state.winchPdf,
      sistrix: state.sistrixPdf,
      historical: historicalText,
      slack: slackResult.data,
      trello: trelloResult.data,
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

    document.getElementById('analysis-output').innerHTML = marked.parse(result.analysis);
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
  navigator.clipboard.writeText(document.getElementById('analysis-output').innerText).then(() => {
    const btn = document.getElementById('copy-btn');
    btn.textContent = 'Kopierad!';
    setTimeout(() => btn.textContent = 'Kopiera', 2000);
  });
}

function exportPdf() {
  window.print();
}
