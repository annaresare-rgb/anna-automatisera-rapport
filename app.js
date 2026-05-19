const analyzeBtn = document.getElementById('analyze-btn');
const resultCard = document.getElementById('result-card');
const analysisOutput = document.getElementById('analysis-output');
const copyBtn = document.getElementById('copy-btn');

analyzeBtn.addEventListener('click', runAnalysis);
copyBtn.addEventListener('click', copyText);

async function runAnalysis() {
  const client = document.getElementById('client-name').value.trim();
  const language = document.getElementById('language').value;
  const period = document.getElementById('current-period').value;
  const compareWith = document.getElementById('compare-with').value;

  if (!client) {
    alert('Fyll i kundnamn.');
    return;
  }
  if (!period) {
    alert('Välj aktuell period.');
    return;
  }

  const data = {
    gsc: document.getElementById('gsc-data').value.trim(),
    ga4: document.getElementById('ga4-data').value.trim(),
    sistrix: document.getElementById('sistrix-data').value.trim(),
    wincher: document.getElementById('wincher-data').value.trim(),
  };

  if (!Object.values(data).some(v => v)) {
    alert('Klistra in data från minst ett verktyg.');
    return;
  }

  analyzeBtn.disabled = true;
  analyzeBtn.textContent = 'Analyserar...';
  resultCard.classList.add('hidden');

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client, language, period, compareWith, data }),
    });

    if (!response.ok) {
      throw new Error('Något gick fel på servern.');
    }

    const result = await response.json();

    analysisOutput.textContent = result.analysis;
    resultCard.classList.remove('hidden');
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    alert('Kunde inte analysera datan. Försök igen.');
    console.error(err);
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = 'Analysera data';
  }
}

function copyText() {
  const text = analysisOutput.textContent;
  navigator.clipboard.writeText(text).then(() => {
    copyBtn.textContent = 'Kopierad!';
    setTimeout(() => (copyBtn.textContent = 'Kopiera text'), 2000);
  });
}
