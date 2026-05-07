// Main app logic

class ChineseQAApp {
  constructor() {
    this.api = null;
    this.storageKey = 'apiKey';
    this.storageKeySavedAt = 'apiKeySavedAt';
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

    document.getElementById('save-config')?.addEventListener('click', async () => {
      await this.saveConfig();
    });
  }

  loadConfig() {
    const input = document.getElementById('api-key');
    if (input) {
      input.value = '';
    }

    const key = localStorage.getItem(this.storageKey);
    const savedAt = localStorage.getItem(this.storageKeySavedAt);

    if (key && !savedAt) {
      localStorage.removeItem(this.storageKey);
      this.updateDebug('status', 'Removed old local API key without timestamp. Using server gateway.');
      this.initAPI('');
      this.updateConfigIndicator(false);
      return;
    }

    if (key && savedAt && Number.isNaN(Date.parse(savedAt))) {
      localStorage.removeItem(this.storageKey);
      localStorage.removeItem(this.storageKeySavedAt);
      this.updateDebug('status', 'Removed local API key with invalid timestamp. Using server gateway.');
      this.initAPI('');
      this.updateConfigIndicator(false);
      return;
    }

    if (!key) {
      this.updateDebug('status', 'No local API key found. Using server gateway.');
      this.initAPI('');
      this.updateConfigIndicator(false);
      return;
    }

    this.initAPI(key);
    this.updateConfigIndicator(true, savedAt || '');
    this.updateDebug('status', `Local API key loaded (saved ${savedAt}). Direct mode ready.`);
  }

  async saveConfig() {
    const input = document.getElementById('api-key');
    if (!input) {
      return;
    }

    const key = input.value.trim();
    if (!key) {
      localStorage.removeItem(this.storageKey);
      localStorage.removeItem(this.storageKeySavedAt);
      this.initAPI('');
      this.updateConfigIndicator(false);
      this.updateDebug('status', 'Local API key cleared. Using server gateway.');
      alert('Local API key cleared. App will use server gateway.');
      return;
    }

    this.setConfigBusy(true, 'Validating API key...');
    const isValid = await this.validateApiKey(key);
    if (!isValid) {
      this.setConfigBusy(false);
      this.updateDebug('status', 'API key validation failed. Key not saved.');
      alert('API key validation failed. Please check the key and try again.');
      return;
    }

    const savedAt = new Date().toISOString();
    localStorage.setItem(this.storageKey, key);
    localStorage.setItem(this.storageKeySavedAt, savedAt);
    this.initAPI(key);
    this.updateConfigIndicator(true, savedAt);
    input.value = '';
    this.setConfigBusy(false);
    alert(`Local API key saved (${savedAt}).`);
  }

  async validateApiKey(key) {
    const baseUrl = window.CONFIG?.API_BASE || 'https://openrouter.ai/api/v1';

    try {
      const response = await fetch(`${baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${key}`
        }
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return Array.isArray(data?.data);
    } catch (_error) {
      return false;
    }
  }

  setConfigBusy(isBusy, label = 'Validate + Save Key') {
    const saveButton = document.getElementById('save-config');
    const keyInput = document.getElementById('api-key');

    if (saveButton) {
      saveButton.disabled = isBusy;
      saveButton.textContent = isBusy ? label : 'Validate + Save Key';
    }

    if (keyInput) {
      keyInput.disabled = isBusy;
    }
  }

  updateConfigIndicator(hasKey, savedAt = '') {
    const indicator = document.getElementById('config-key-indicator');
    if (!indicator) {
      return;
    }

    indicator.classList.remove('is-valid', 'is-missing');
    if (hasKey) {
      indicator.classList.add('is-valid');
      indicator.textContent = savedAt ? 'Key stored and verified' : 'Key stored';
      return;
    }

    indicator.classList.add('is-missing');
    indicator.textContent = 'No key stored';
  }

  initAPI(key = '') {
    this.api = new ChineseQAAPI(key);
    const mode = this.api.getMode();
    if (mode === 'direct') {
      this.updateDebug('status', 'Using local API key. Direct OpenRouter mode ready.');
      return;
    }
    this.updateDebug('status', 'Using server gateway mode (no local key).');
  }

  async handleQuestion1() {
    const char = document.getElementById('q1-char').value.trim();
    const sentence = document.getElementById('q1-sentence').value.trim();

    if (!char || !sentence) {
      this.showResponse('Please fill in all fields', true, 'Q1');
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
      this.showResponse('Please fill in all fields', true, 'Q2');
      return;
    }

    const question = `Why can't I use "${phrase1}" instead of "${phrase2}" in the sentence: "${sentence}"?`;
    await this.submitQuery(question, 'Q2');
  }

  async handleQuestion3() {
    const sentence = document.getElementById('q3-sentence').value.trim();

    if (!sentence) {
      this.showResponse('Please fill in the sentence', true, 'Q3');
      return;
    }

    const question = `Is this a natural-sounding sentence in Chinese: "${sentence}"? If not, how would you rephrase it?`;
    await this.submitQuery(question, 'Q3');
  }

  async submitQuery(question, source) {
    if (!this.api) {
      this.initAPI('');
    }

    const mode = this.api.getMode();

    this.updateDebug('status', `Submitting ${source} via ${mode} mode...`);
    this.updateDebug('prompt', question);
    this.updateDebug('raw', 'Waiting for API response...');
    this.updateDebug('parsed', 'Waiting for parsed content...');
    this.showResponse('Loading...', false, source);

    try {
      const result = await this.api.query(question);
      this.updateDebug('status', `${source} complete via ${result.mode || mode}.`);
      this.updateDebug('raw', result.raw);
      this.updateDebug('parsed', result.content);
      this.showResponse(result.content, false, source);
    } catch (err) {
      console.error('Query error:', err);
      this.updateDebug('status', 'Request failed.');
      if (err.raw) {
        this.updateDebug('raw', err.raw);
      }
      this.updateDebug('parsed', err.message);
      this.showResponse(`Error: ${err.message}`, true, source);
    }
  }

  getFormGroupForSource(source) {
    const buttonIdBySource = {
      Q1: 'q1-submit',
      Q2: 'q2-submit',
      Q3: 'q3-submit'
    };

    const buttonId = buttonIdBySource[source];
    if (!buttonId) {
      return null;
    }

    const button = document.getElementById(buttonId);
    return button ? button.closest('.form-group') : null;
  }

  prepareResponseContainer(source) {
    const respDiv = document.getElementById('response');
    if (!respDiv) {
      return null;
    }

    const targetGroup = this.getFormGroupForSource(source);
    if (targetGroup && respDiv.parentElement !== targetGroup) {
      targetGroup.appendChild(respDiv);
    }

    respDiv.classList.remove('show', 'error', 'loading');
    respDiv.innerHTML = '';
    return respDiv;
  }

  showResponse(text, isError = false, source = 'Q1') {
    const respDiv = this.prepareResponseContainer(source);
    if (!respDiv) {
      return;
    }

    if (!text || typeof text !== 'string') {
      text = 'Unknown error occurred';
    }
    const safeText = text === 'Loading...'
      ? this.escapeHtml(text)
      : this.formatResponseText(text);
    respDiv.innerHTML = `<h3>${isError ? '⚠️ Error' : '✓ Response'}</h3><div class="response-body">${safeText}</div>`;
    respDiv.classList.toggle('error', isError);
    respDiv.classList.toggle('loading', text === 'Loading...');
    respDiv.classList.add('show');
  }

  formatResponseText(text) {
    const escaped = this.escapeHtml(text).replace(/\r\n|\r/g, '\n');
    const lines = escaped.split('\n');
    const html = [];
    let inList = false;
    let inCodeBlock = false;

    const closeList = () => {
      if (!inList) {
        return;
      }
      html.push('</ul>');
      inList = false;
    };

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();

      if (/^```/.test(line.trim())) {
        closeList();
        if (!inCodeBlock) {
          html.push('<pre class="response-code"><code>');
          inCodeBlock = true;
          continue;
        }
        html.push('</code></pre>');
        inCodeBlock = false;
        continue;
      }

      if (inCodeBlock) {
        html.push(`${line}\n`);
        continue;
      }

      if (!line.trim()) {
        closeList();
        html.push('<br>');
        continue;
      }

      const listMatch = line.match(/^\s*[-*]\s+(.*)$/);
      if (listMatch) {
        if (!inList) {
          html.push('<ul>');
          inList = true;
        }
        html.push(`<li>${this.formatInlineMarkdown(listMatch[1])}</li>`);
        continue;
      }

      closeList();
      html.push(`<p>${this.formatInlineMarkdown(line.trim())}</p>`);
    }

    closeList();
    if (inCodeBlock) {
      html.push('</code></pre>');
    }

    return html.join('');
  }

  formatInlineMarkdown(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+?)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
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
