// Main app logic

class ChineseQAApp {
  constructor() {
    this.api = null;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadConfig();
  }

  setupEventListeners() {
    document.getElementById('q1-submit')?.addEventListener('click', () => {
      this.handleQuestion1();
    });

    document.getElementById('q2-submit')?.addEventListener('click', () => {
      this.handleQuestion2();
    });

    document.getElementById('q3-submit')?.addEventListener('click', () => {
      this.handleQuestion3();
    });

    document.getElementById('save-config')?.addEventListener('click', () => {
      this.saveConfig();
    });
  }

  loadConfig() {
    const saved = localStorage.getItem('apiKey');
    const configured = window.CONFIG?.OPENROUTER_API_KEY;
    const hasConfiguredKey = configured && configured !== 'your-api-key-here' && configured !== 'sk-or-...your-key-here...';
    const key = saved || (hasConfiguredKey ? configured : '');

    if (!key) {
      this.updateDebug('status', 'No API key loaded yet.');
      return;
    }

    document.getElementById('api-key').value = key;
    this.initAPI(key);
  }

  saveConfig() {
    const key = document.getElementById('api-key').value.trim();
    if (!key) {
      alert('API key cannot be empty');
      return;
    }
    localStorage.setItem('apiKey', key);
    this.initAPI(key);
    alert('Config saved');
  }

  initAPI(key) {
    window.CONFIG.OPENROUTER_API_KEY = key;
    this.api = new ChineseQAAPI(key);
    this.updateDebug('status', 'API key loaded. Ready.');
  }

  async handleQuestion1() {
    const char = document.getElementById('q1-char').value.trim();
    const sentence = document.getElementById('q1-sentence').value.trim();

    if (!char || !sentence) {
      this.showResponse('Please fill in all fields', true);
      return;
    }

    const question = `What does the character "${char}" mean in this sentence: "${sentence}"?`;
    await this.submitQuery(question, 'Q1');
  }

  async handleQuestion2() {
    const phrase1 = document.getElementById('q2-phrase-alt').value.trim();
    const phrase2 = document.getElementById('q2-phrase-correct').value.trim();
    const sentence = document.getElementById('q2-sentence-alt').value.trim();

    if (!phrase1 || !phrase2 || !sentence) {
      this.showResponse('Please fill in all fields', true);
      return;
    }

    const question = `Why can't I use "${phrase1}" instead of "${phrase2}" in the sentence: "${sentence}"?`;
    await this.submitQuery(question, 'Q2');
  }

  async handleQuestion3() {
    const sentence = document.getElementById('q3-sentence').value.trim();

    if (!sentence) {
      this.showResponse('Please fill in the sentence', true);
      return;
    }

    const question = `Is this a natural-sounding sentence in Chinese: "${sentence}"? If not, how would you rephrase it?`;
    await this.submitQuery(question, 'Q3');
  }

  async submitQuery(question, source) {
    if (!this.api) {
      this.showResponse('⚠️ API key not configured. Scroll to Config section → enter OpenRouter key → Save', true);
      this.updateDebug('status', 'Blocked: missing API key.');
      return;
    }

    this.updateDebug('status', `Submitting ${source}...`);
    this.updateDebug('prompt', question);
    this.updateDebug('raw', 'Waiting for API response...');
    this.updateDebug('parsed', 'Waiting for parsed content...');
    this.showResponse('Loading...', false);

    try {
      const result = await this.api.query(question);
      this.updateDebug('status', `${source} complete.`);
      this.updateDebug('raw', result.raw);
      this.updateDebug('parsed', result.content);
      this.showResponse(result.content, false);
    } catch (err) {
      console.error('Query error:', err);
      this.updateDebug('status', 'Request failed.');
      if (err.raw) {
        this.updateDebug('raw', err.raw);
      }
      this.updateDebug('parsed', err.message);
      this.showResponse(`Error: ${err.message}`, true);
    }
  }

  showResponse(text, isError = false) {
    const respDiv = document.getElementById('response');
    if (!text || typeof text !== 'string') {
      text = 'Unknown error occurred';
    }
    respDiv.innerHTML = `<h3>${isError ? '⚠️ Error' : '✓ Response'}</h3><p>${this.escapeHtml(text)}</p>`;
    respDiv.classList.toggle('error', isError);
    respDiv.classList.toggle('loading', text === 'Loading...');
    respDiv.classList.add('show');
  }

  escapeHtml(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  updateDebug(section, value) {
    const target = document.getElementById(`debug-${section}`);
    if (!target) {
      return;
    }

    if (typeof value === 'string') {
      target.textContent = value;
      return;
    }

    try {
      target.textContent = JSON.stringify(value, null, 2);
    } catch (_error) {
      target.textContent = String(value);
    }
  }
}

// Init when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  new ChineseQAApp();
});
