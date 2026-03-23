const form = document.getElementById('config-form');
const btnProcess = document.getElementById('btn-process');
const btnCancel = document.getElementById('btn-cancel');
const progressSection = document.getElementById('progress-section');
const progressPhase = document.getElementById('progress-phase');
const progressCount = document.getElementById('progress-count');
const progressFill = document.getElementById('progress-fill');
const logContent = document.getElementById('log-content');
const logPanel = document.getElementById('log-panel');
const summarySection = document.getElementById('summary-section');
const summaryContent = document.getElementById('summary-content');
const btnOpenFolder = document.getElementById('btn-open-folder');

let outputDir = '';
let logLines = 0;
const MAX_LOG_LINES = 200;

// --- Load saved config ---
(async () => {
  const config = await window.api.getSavedConfig();
  if (!config) return;
  if (config.apiKey) document.getElementById('api-key').value = config.apiKey;
  if (config.inputDir) document.getElementById('input-dir').value = config.inputDir;
  if (config.outputDir) document.getElementById('output-dir').value = config.outputDir;
  if (config.language) document.getElementById('language').value = config.language;
  if (config.context) document.getElementById('context').value = config.context;
  if (config.model) document.getElementById('model').value = config.model;
  if (config.concurrency) document.getElementById('concurrency').value = config.concurrency;
  if (config.rpm) document.getElementById('rpm').value = config.rpm;
  if (config.quality) document.getElementById('quality').value = config.quality;
})();

// --- Folder selection ---
document.querySelectorAll('[data-select]').forEach(btn => {
  btn.addEventListener('click', async () => {
    const targetId = btn.dataset.select;
    const title = targetId === 'input-dir'
      ? 'Selecciona carpeta de entrada'
      : 'Selecciona carpeta de salida';
    const selectedPath = await window.api.selectFolder(title);
    if (selectedPath) {
      document.getElementById(targetId).value = selectedPath;
    }
  });
});

// --- Start processing ---
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const inputDir = document.getElementById('input-dir').value;
  const outDir = document.getElementById('output-dir').value;
  const apiKey = document.getElementById('api-key').value;

  if (!inputDir || !outDir || !apiKey) {
    alert('Completa: carpetas de entrada/salida y API key.');
    return;
  }

  outputDir = outDir;

  const config = {
    apiKey,
    inputDir,
    outputDir: outDir,
    language: document.getElementById('language').value,
    context: document.getElementById('context').value,
    model: document.getElementById('model').value,
    concurrency: parseInt(document.getElementById('concurrency').value),
    rpm: parseInt(document.getElementById('rpm').value),
    quality: parseInt(document.getElementById('quality').value),
  };

  await window.api.saveConfig(config);

  setProcessing(true);
  logContent.innerHTML = '';
  logLines = 0;
  summarySection.style.display = 'none';
  progressSection.style.display = 'block';
  progressFill.style.width = '0%';

  await window.api.startProcessing(config);
});

// --- Cancel ---
btnCancel.addEventListener('click', async () => {
  await window.api.cancelProcessing();
  addLog('system', 'Cancelado por el usuario.');
  setProcessing(false);
});

// --- IPC event listeners ---
window.api.onProgressUpdate((data) => {
  progressPhase.textContent = data.phase + '...';
  progressCount.textContent = `${data.current}/${data.total}`;
  const pct = data.total > 0 ? (data.current / data.total) * 100 : 0;
  progressFill.style.width = pct + '%';
});

window.api.onLogEntry((data) => {
  addLog(data.tag, data.message);
});

window.api.onProcessingComplete((data) => {
  setProcessing(false);
  progressFill.style.width = '100%';
  summarySection.style.display = 'block';
  summaryContent.innerHTML =
    `<p>Imágenes convertidas: <strong>${data.totalProcessed}</strong></p>` +
    `<p>Errores: <strong>${data.errors}</strong></p>` +
    (data.elapsed ? `<p>Tiempo: <strong>${data.elapsed}</strong></p>` : '') +
    (data.cost ? `<p>Coste estimado: <strong>${data.cost}</strong></p>` : '');
  outputDir = data.outputDir;
});

window.api.onProcessingError((data) => {
  setProcessing(false);
  addLog('error', 'Error fatal: ' + data.message);
});

// --- Open output folder ---
btnOpenFolder.addEventListener('click', () => {
  if (outputDir) window.api.openFolder(outputDir);
});

// --- Helpers ---
function setProcessing(active) {
  btnProcess.style.display = active ? 'none' : '';
  btnCancel.style.display = active ? '' : 'none';
  form.querySelectorAll('input, select').forEach(el => el.disabled = active);
  form.querySelectorAll('[data-select]').forEach(el => el.disabled = active);
}

function addLog(tag, message) {
  const line = document.createElement('div');
  line.innerHTML = `<span class="log-${tag}">[${tag}]</span> ${escapeHtml(message)}`;
  logContent.appendChild(line);
  logLines++;

  while (logLines > MAX_LOG_LINES && logContent.firstChild) {
    logContent.removeChild(logContent.firstChild);
    logLines--;
  }

  logPanel.scrollTop = logPanel.scrollHeight;
}

function escapeHtml(text) {
  const el = document.createElement('span');
  el.textContent = text;
  return el.innerHTML;
}
