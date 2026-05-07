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
    // Character meaning form
    document.getElementById('q1-submit')?.addEventListener('click', () => {
      this.handleQuestion1();
    });

    // Phrase alternative form
    document.getElementById('q2-submit')?.addEventListener('click', () => {
      this.handleQuestion2();
    });

    // Naturalness check form
    document.getElementById('q3-submit')?.addEventListener('click', () => {
      this.handleQuestion3();
    });

    // Config save
    document.getElementById('save-config')?.addEventListener('click', () => {
      this.saveConfig();
    });
  }

  loadConfig() {
    const saved = localStorage.getItem('apiKey');
    if (saved) {
      document.getElementById('api-key').value = saved;
      this.initAPI(saved);
    }
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
    CONFIG.OPENROUTER_API_KEY = key;
    this.api = new ChineseQAAPI(key);
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
      return;
    }

    this.showResponse('Loading...', false);

    try {
      const response = await this.api.query(question);
      this.showResponse(response, false);
    } catch (err) {
      console.error('Query error:', err);
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
}

// Init when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  new ChineseQAApp();
});
