// Main app logic

class ChineseQAApp {
  constructor() {
    this.api = null;
    this.storageKey = 'apiKey';
    this.storageKeySavedAt = 'apiKeySavedAt';
    const debugEnabled = Boolean(window.CONFIG?.ENABLE_DEBUG_PANEL);
    this.debug = window.AppDebug
      ? new window.AppDebug({ enabled: debugEnabled })
      : { update: () => {}, setEnabled: () => {} };
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.initClearButtons();
    // Must run after initClearButtons(): setupToneSuggestions binds to the
    // .input-clear-wrap wrapper that initClearButtons creates, so binding it
    // earlier finds no wrapper and silently does nothing.
    this.setupToneSuggestions();
    this.loadConfig();
  }

  initClearButtons() {
    const inputs = document.querySelectorAll('input[type="text"], input[type="password"]');

    inputs.forEach(input => {
      if (input.dataset.clearEnabled === 'true') {
        return;
      }

      input.dataset.clearEnabled = 'true';

      const wrapper = document.createElement('div');
      wrapper.classList.add('input-clear-wrap');

      if (input.classList.contains('slot-input-short')) {
        wrapper.classList.add('slot-input-short-wrap');
      }

      if (input.classList.contains('slot-input-long')) {
        wrapper.classList.add('slot-input-long-wrap');
      }

      if (input.classList.contains('slot-input-tone')) {
        wrapper.classList.add('slot-input-tone-wrap');
      }

      if (!input.classList.contains('slot-input')) {
        wrapper.classList.add('full-width');
      }

      const parent = input.parentElement;
      if (!parent) {
        return;
      }

      parent.insertBefore(wrapper, input);
      wrapper.appendChild(input);

      const clearButton = document.createElement('button');
      clearButton.type = 'button';
      clearButton.className = 'clear-input-btn';
      clearButton.setAttribute('aria-label', 'Clear text');
      clearButton.setAttribute('title', 'Clear');
      clearButton.textContent = '×';
      wrapper.appendChild(clearButton);

      const syncClearState = () => {
        wrapper.classList.toggle('has-value', Boolean(input.value));
      };

      input.addEventListener('input', syncClearState);
      input.addEventListener('focus', syncClearState);
      input.addEventListener('blur', syncClearState);

      input.addEventListener('keydown', event => {
        if (event.key !== 'Escape') {
          return;
        }

        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });

      clearButton.addEventListener('click', () => {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
      });

      syncClearState();
    });
  }

  // The tone field draws its own chevron (see .slot-input-tone in styles.css)
  // because the shared clear button covers the native datalist indicator. A
  // drawn arrow has to do the opening itself, otherwise it is just decoration:
  // clicking it focuses the input and dispatches the ArrowDown that Chrome
  // reads as "show suggestions". Choosing an item fills the input, so the
  // field still accepts anything typed by hand.
  setupToneSuggestions() {
    const tone = document.getElementById('q4-tone');
    const wrap = tone?.closest('.input-clear-wrap');
    if (!tone || !wrap) {
      return;
    }

    const openSuggestions = () => {
      tone.focus();
      tone.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        code: 'ArrowDown',
        keyCode: 40,
        which: 40,
        bubbles: true
      }));
    };

    wrap.addEventListener('click', event => {
      // Ignore clicks on the clear button itself; it handles its own action.
      if (event.target.closest('.clear-input-btn')) {
        return;
      }
      openSuggestions();
    });
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

    document.getElementById('q4-submit')?.addEventListener('click', () => {
      this.handleQuestion4();
    });

    document.getElementById('q5-submit')?.addEventListener('click', () => {
      this.handleQuestion5();
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
      this.showConfigMessage('Local key cleared. Using server gateway.', 'success');
      return;
    }

    if (!this.isLikelyOpenRouterKey(key)) {
      this.updateDebug('status', 'API key format rejected before validation call.');
      this.showConfigMessage('Key format invalid. Expected format: sk-or-v1-...', 'error');
      return;
    }

    this.setConfigBusy(true, 'Validating API key...');
    const validation = await this.validateApiKey(key);
    if (!validation.ok) {
      this.setConfigBusy(false);
      this.updateDebug('status', `API key validation failed. Key not saved. ${validation.message}`);
      this.showConfigMessage(`Validation failed: ${validation.message}`, 'error');
      return;
    }

    const savedAt = new Date().toISOString();
    localStorage.setItem(this.storageKey, key);
    localStorage.setItem(this.storageKeySavedAt, savedAt);
    this.initAPI(key);
    this.updateConfigIndicator(true, savedAt);
    input.value = '';
    this.setConfigBusy(false);
    this.showConfigMessage('API key validated and saved locally.', 'success');
  }

  async validateApiKey(key) {
    const baseUrl = window.CONFIG?.API_BASE || 'https://openrouter.ai/api/v1';
    const model = 'openrouter/auto';
    const probeBody = {
      model,
      messages: [
        {
          role: 'user',
          content: 'This is a validation prompt. All you have to reply is YES. Nothing else.'
        }
      ],
      max_tokens: 8,
      temperature: 0
    };

    const fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify(probeBody)
    };

    try {
      let response = await fetch(`${baseUrl}/chat/completions`, fetchOptions);
      let data = await response.json().catch(() => ({}));

      // Retry once for transient upstream/provider issues.
      if (!response.ok) {
        const firstMessage = data?.error?.message || data?.message || `HTTP ${response.status}`;
        const transientProviderIssue = /provider returned error|upstream|timeout|temporar|overloaded/i.test(firstMessage);
        if (transientProviderIssue) {
          response = await fetch(`${baseUrl}/chat/completions`, fetchOptions);
          data = await response.json().catch(() => ({}));
        }
      }

      if (response.ok) {
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content !== 'string' || !content.trim()) {
          return { ok: false, message: 'No content returned from validation call' };
        }

        if (!/\bYES\b/i.test(content)) {
          return { ok: false, message: 'Validation probe did not return YES' };
        }

        return { ok: true, message: 'Valid key' };
      }

      const message = data?.error?.message || data?.message || `HTTP ${response.status}`;
      const providerIssue = /provider returned error|upstream|timeout|temporar|overloaded/i.test(message);

      // If provider is failing but auth is valid, allow saving instead of false-negative rejection.
      if (providerIssue) {
        const authResponse = await fetch(`${baseUrl}/models`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${key}`
          }
        });

        if (authResponse.ok) {
          const modelData = await authResponse.json().catch(() => ({}));
          if (Array.isArray(modelData?.data)) {
            return { ok: true, message: 'Valid key (provider had a temporary error during probe)' };
          }
        }
      }

      return { ok: false, message };
    } catch (_error) {
      return { ok: false, message: 'Network/CORS error during validation' };
    }
  }

  isLikelyOpenRouterKey(key) {
    // Basic hardening: enforce expected prefix/charset and reasonable length.
    if (typeof key !== 'string') {
      return false;
    }

    if (key.length < 20 || key.length > 256) {
      return false;
    }

    return /^sk-or-v1-[A-Za-z0-9_-]+$/.test(key);
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

  showConfigMessage(message, type = 'success') {
    const container = document.getElementById('config-messages');
    if (!container) {
      return;
    }

    const pill = document.createElement('div');
    pill.classList.add('config-pill');
    pill.classList.add(type === 'error' ? 'config-pill-error' : 'config-pill-success');
    pill.textContent = message;
    container.prepend(pill);

    setTimeout(() => {
      pill.classList.add('fade');
    }, 10000);

    setTimeout(() => {
      pill.remove();
    }, 10550);
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

    const question = `What does "${char}" mean, or what function does it perform, in this sentence: "${sentence}"?`;
    await this.submitQuery(question, 'Q1', sentence);
  }

  async handleQuestion2() {
    const phrase1 = document.getElementById('q2-phrase-alt').value.trim();
    const phrase2 = document.getElementById('q2-phrase-correct').value.trim();
    const sentence = document.getElementById('q2-sentence-alt').value.trim();

    if (!phrase1 || !phrase2 || !sentence) {
      this.showResponse('Please fill in all fields', true, 'Q2');
      return;
    }

    const question = `In the sentence "${sentence}", can I use "${phrase1}" instead of "${phrase2}"? If "${phrase1}" looks like a typo, guess the most likely intended word and explain whether that corrected sentence is natural.`;
    await this.submitQuery(question, 'Q2', sentence);
  }

  async handleQuestion3() {
    const sentence = document.getElementById('q3-sentence').value.trim();

    if (!sentence) {
      this.showResponse('Please fill in the sentence', true, 'Q3');
      return;
    }

    const question = `Does this sentence sound natural to native Chinese speakers: "${sentence}"? If not, how would you rephrase it?`;
    await this.submitQuery(question, 'Q3', sentence);
  }

  async handleQuestion4() {
    const sentence = document.getElementById('q4-sentence').value.trim();
    const toneField = document.getElementById('q4-tone');
    // Free text: the datalist only suggests, the user can type anything.
    const tone = toneField ? toneField.value.trim() : '';

    if (!sentence || !tone) {
      this.showResponse('Please fill in all fields', true, 'Q4');
      return;
    }

    const question = `Rewrite this Chinese sentence so that it sounds ${tone}: "${sentence}". `
      + 'Give the rewritten sentence first, then a short explanation of what changed and why '
      + 'it conveys that tone. Keep the meaning the same.';
    await this.submitQuery(question, 'Q4', sentence);
  }

  async handleQuestion5() {
    const word = document.getElementById('q5-word').value.trim();
    const sentence = document.getElementById('q5-sentence').value.trim();

    if (!word || !sentence) {
      this.showResponse('Please fill in all fields', true, 'Q5');
      return;
    }

    const question = `In the sentence "${sentence}", what other words could I use instead of "${word}"? `
      + 'Suggest several alternatives that fit the context, and for each one say whether it changes '
      + 'the meaning, the level of politeness, or the formality compared with the original. '
      + `First confirm that "${word}" appears in the sentence and is being used correctly.`;
    await this.submitQuery(question, 'Q5', sentence);
  }

  async submitQuery(question, source, context = '') {
    if (!this.api) {
      this.initAPI('');
    }

    const mode = this.api.getMode();

    this.updateDebug('status', `Submitting ${source} via ${mode} mode...`);
    this.updateDebug('prompt', question);
    this.updateDebug('roles', 'Waiting for request payload...');
    this.updateDebug('context', context || '(empty)');
    this.updateDebug('raw', 'Waiting for API stream...');
    this.updateDebug('parsed', 'Waiting for parsed content...');
    this.showResponse('Loading...', false, source);

    try {
      let sawToken = false;
      const result = await this.api.query(question, context, {
        onToken: (_token, fullText) => {
          sawToken = true;
          this.updateDebug('status', `Streaming ${source} via ${mode} mode...`);
          this.updateDebug('parsed', fullText || '');
          this.showResponse(fullText || 'Loading...', false, source);
        }
      });

      const rolesSent = Array.isArray(result?.requestBody?.messages)
        ? result.requestBody.messages.map(m => m?.role || '(missing role)')
        : [];

      this.updateDebug('status', `${source} complete via ${result.mode || mode}.`);
      this.updateDebug('roles', rolesSent.length > 0 ? rolesSent.join(' -> ') : 'No message roles found');
      this.updateDebug('context', context || '(empty)');
      this.updateDebug('raw', result.raw);
      this.updateDebug('parsed', result.content);
      if (!sawToken || !result.content) {
        this.showResponse(result.content, false, source);
      }
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
      Q3: 'q3-submit',
      Q4: 'q4-submit',
      Q5: 'q5-submit'
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

    document.querySelectorAll('.form-group.is-active').forEach(group => {
      group.classList.remove('is-active');
    });

    if (targetGroup) {
      targetGroup.classList.add('is-active');
    }

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

      // Horizontal rule support for markdown separators like ---
      if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
        closeList();
        html.push('<hr>');
        continue;
      }

      const headingMatch = line.match(/^\s*(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        closeList();
        const level = headingMatch[1].length;
        html.push(`<h${level}>${this.formatInlineMarkdown(headingMatch[2].trim())}</h${level}>`);
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

  // Models occasionally emit LaTeX for simple symbols (e.g. "$\rightarrow$"
  // instead of the arrow character). Rendered as-is it reads as noise to a
  // language learner, so map the common ones to plain Unicode. Anything not
  // in the table is unwrapped rather than left showing backslashes.
  normalizeLatexSymbols(text) {
    if (!text || typeof text !== 'string' || !text.includes('$')) {
      return text;
    }

    const symbols = {
      rightarrow: '→',
      leftarrow: '←',
      uparrow: '↑',
      downarrow: '↓',
      leftrightarrow: '↔',
      Rightarrow: '⇒',
      Leftrightarrow: '⇔',
      times: '×',
      div: '÷',
      pm: '±',
      cdot: '·',
      leq: '≤',
      geq: '≥',
      neq: '≠',
      approx: '≈',
      equiv: '≡',
      infty: '∞',
      degree: '°',
      celsius: '°C',
      checkmark: '✓',
      textbullet: '•',
      ldots: '…',
      dots: '…'
    };

    // Brace-arg commands first, so the argument is consumed with them rather
    // than being left behind as a stray "foo{x}".
    let cleaned = text
      .replace(/\\(?:text|mathrm|mathbf|mathit|textbf|textit|textbf)\{([^{}]*)\}/g, '$1')
      .replace(/\\boxed\{([^{}]*)\}/g, '$1')
      .replace(/\\color\{[^{}]*\}\{([^{}]*)\}/g, '$1');

    // \cmd{arg}: known symbol wins, otherwise keep the name and drop the braces.
    cleaned = cleaned.replace(/\\([A-Za-z]+)\{([^{}]*)\}/g, (match, name, arg) => {
      if (Object.prototype.hasOwnProperty.call(symbols, name)) {
        return symbols[name];
      }
      return name + arg;
    });

    cleaned = cleaned
      // Bare \cmd with no argument.
      .replace(/\\([A-Za-z]+)/g, (match, name) => (
        Object.prototype.hasOwnProperty.call(symbols, name) ? symbols[name] : name
      ))
      // Strip surviving $...$ delimiters and LaTeX spacing commands.
      .replace(/\$\$?([^$]*)\$\$?/g, '$1')
      .replace(/\\[,;:! ]/g, ' ');

    if (cleaned === text) {
      // Nothing was LaTeX -- return the original, spacing untouched.
      return text;
    }

    // Removing "$" delimiters can leave a gap before punctuation
    // ("$\\to$." -> "→ ."). Fix just that; do not collapse runs of spaces
    // elsewhere, since markdown list markers rely on them.
    return cleaned.replace(/[ \t]+([,.!?;:])/g, '$1');
  }

  formatInlineMarkdown(text) {
    return this.normalizeLatexSymbols(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
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
    this.debug.update(section, value);
  }
}

// Init when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  new ChineseQAApp();
});
