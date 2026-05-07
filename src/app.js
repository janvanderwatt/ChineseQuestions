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
      this.showResponse('⚠️ API key not configured. Scroll to Config section → enter OpenRouter key → Save', true, source);
      this.updateDebug('status', 'Blocked: missing API key.');
      return;
    }

    this.updateDebug('status', `Submitting ${source}...`);
    this.updateDebug('prompt', question);
    this.updateDebug('raw', 'Waiting for API response...');
    this.updateDebug('parsed', 'Waiting for parsed content...');
    this.showResponse('Loading...', false, source);

    try {
      const result = await this.api.query(question);
      this.updateDebug('status', `${source} complete.`);
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
