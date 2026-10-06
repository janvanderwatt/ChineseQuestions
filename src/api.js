// OpenRouter API wrapper

// Fallback config if config.js is missing.
window.CONFIG = window.CONFIG || {
  OPENROUTER_API_KEY: '',
  OPENROUTER_MODEL: 'google/gemma-4-26b-a4b-it:free',
  OPENROUTER_MODEL_FALLBACKS: ['nvidia/nemotron-3-super-120b-a12b:free'],
  API_BASE: 'https://openrouter.ai/api/v1',
  GATEWAY_URL: '/api/openrouter-gateway.php'
};

// Used only when config.js supplies no usable model list.
const BUILTIN_DEFAULT_MODEL = 'google/gemma-4-26b-a4b-it:free';
const BUILTIN_DEFAULT_FALLBACKS = ['nvidia/nemotron-3-super-120b-a12b:free'];

// Failures worth retrying on the next model: transient upstream/provider
// errors, rate limits, and empty replies. Empty replies matter because
// reasoning models can spend the whole max_tokens budget on internal
// reasoning and return content: null.
const RETRYABLE_PATTERN = /provider returned error|upstream|timeout|temporar|overloaded|rate.?limit|\b429\b|\b500\b|\b502\b|\b503\b|empty response/i;

class ChineseQAAPI {
  constructor(apiKey = '') {
    this.apiKey = apiKey;
    this.baseUrl = window.CONFIG.API_BASE;
    this.gatewayUrl = window.CONFIG.GATEWAY_URL || '/api/openrouter-gateway.php';
    this.models = this._resolveModels();
  }

  // Build the ordered model list: configured primary first, then any
  // configured fallbacks. Unlike the previous version this does NOT rewrite
  // 'openrouter/auto' into a paid model -- whatever is configured is used
  // verbatim, so the no-key path never silently spends credits.
  _resolveModels() {
    const clean = value => (typeof value === 'string' ? value.trim() : '');

    const primary = clean(window.CONFIG.OPENROUTER_MODEL) || BUILTIN_DEFAULT_MODEL;
    const configuredFallbacks = Array.isArray(window.CONFIG.OPENROUTER_MODEL_FALLBACKS)
      ? window.CONFIG.OPENROUTER_MODEL_FALLBACKS
      : BUILTIN_DEFAULT_FALLBACKS;

    const models = [primary, ...configuredFallbacks]
      .map(clean)
      .filter((model, index, all) => model && all.indexOf(model) === index);

    return models.length > 0 ? models : [BUILTIN_DEFAULT_MODEL];
  }

  setApiKey(apiKey = '') {
    this.apiKey = apiKey;
  }

  getMode() {
    return this.apiKey ? 'direct' : 'gateway';
  }

  async query(question, context = '', options = {}) {
    const { onToken } = options;
    const prompt = this._buildPrompt(question, context);
    const useDirect = Boolean(this.apiKey);

    const attempts = [];
    let lastError = null;

    for (let index = 0; index < this.models.length; index += 1) {
      const model = this.models[index];
      const isLastModel = index === this.models.length - 1;
      const requestBody = this._buildRequestBody(model, prompt, Boolean(onToken));

      // Track whether this attempt already streamed text to the caller.
      // Retrying after partial output would duplicate tokens on screen.
      let streamedAnyToken = false;
      const attemptOnToken = onToken
        ? (token, fullText, rawEvent) => {
            streamedAnyToken = true;
            onToken(token, fullText, rawEvent);
          }
        : undefined;

      try {
        const data = attemptOnToken
          ? (useDirect
            ? await this.queryDirectStream(requestBody, attemptOnToken)
            : await this.queryViaGatewayStream(requestBody, prompt, attemptOnToken))
          : (useDirect
            ? await this.queryDirect(requestBody)
            : await this.queryViaGateway(requestBody, prompt));

        const content = this.extractContent(data);
        if (!content) {
          const emptyError = new Error('Empty response from API');
          emptyError.raw = data;
          throw emptyError;
        }

        return {
          content,
          prompt,
          requestBody,
          model,
          mode: useDirect ? 'direct' : 'gateway',
          attempts,
          raw: data
        };
      } catch (err) {
        const detail = {
          model,
          message: err.message,
          retrying: false
        };

        const canFallBack = !isLastModel
          && !streamedAnyToken
          && RETRYABLE_PATTERN.test(err.message);

        if (canFallBack) {
          detail.retrying = true;
        }

        attempts.push(detail);
        lastError = err;

        if (!canFallBack) {
          const wrappedError = new Error(`API failed: ${err.message}`);
          if (err.raw) {
            wrappedError.raw = err.raw;
          }
          wrappedError.attempts = attempts;
          throw wrappedError;
        }
      }
    }

    const wrappedError = new Error(`API failed: ${lastError?.message || 'No model available'}`);
    if (lastError?.raw) {
      wrappedError.raw = lastError.raw;
    }
    wrappedError.attempts = attempts;
    throw wrappedError;
  }

  _buildRequestBody(model, prompt, stream) {
    return {
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful English-speaking Chinese language tutor. '
            + 'Explain in English with simple practical examples. '
            + 'Keep answers concise and clear. '
            + 'Correction scope is Chinese only: do not correct, rewrite, or critique English spelling/grammar/phrasing in user questions. '
            + 'Before answering, ALWAYS run a correction-first check on user text. '
            + 'Step 1: If any character/phrase looks wrong in context, propose the most likely intended replacement (including same-sound OR similar-shape mistakes). '
            + 'Step 2: After replacement, check whether sentence is still natural. '
            + 'Only output "Possible correction:" when there is a real, high-confidence correction supported by sentence context. '
            + 'If confidence is low or no real correction exists, do not output correction language and continue normal explanation. '
            + 'Do not stop at saying two compared words are different; still propose likely intended word from sentence context. '
            + 'Example: 我的朋友很段 -> likely typo for 我的朋友很短; then explain 很短 is usually length, while people are usually described with 很高/很矮. '
            + 'If the user asks about a sentence, analyze it and point out any unnatural parts and suggest improvements. '
            + 'If the user is asking about a character, explain its meaning and usage in the context of the sentence. '
            + 'If the user is asking about a phrase, explain why it is incorrect and what the correct phrase should be, along with examples. '
            + 'Always provide clear explanations and practical examples to help the user understand Chinese better. '
            + 'STRICT FORMAT RULE: every Chinese character, word, phrase, and sentence must be bold with no exceptions. Never output raw Chinese outside bold formatting. '
            + 'STRICT OUTPUT RULE: Immediately after each Chinese item, include pinyin in brackets in italics. Example: **我的朋友很短** [*Wǒ de péngyǒu hěn duǎn*]. '
            + 'STRICT FORMAT RULE: never use LaTeX, Markdown math, or backslash commands. Write symbols directly as plain Unicode characters (→ ← ≈ ≠ °), not as $\\rightarrow$ or similar. '
            + 'Don\'t suggest follow-up prompts.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 700,
      stream
    };
  }

  async queryDirect(requestBody) {
    const body = { ...requestBody };
    delete body.stream;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    if (!response.ok) {
      const apiMessage = data?.error?.message || data?.message || `API error: ${response.status}`;
      throw new Error(apiMessage);
    }

    return data;
  }

  async queryDirectStream(requestBody, onToken) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    return this.consumeStreamingResponse(response, onToken, 'API');
  }

  async queryViaGateway(requestBody, prompt) {
    const body = { ...requestBody };
    delete body.stream;

    const response = await fetch(this.gatewayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt,
        model: requestBody.model,
        requestBody: body
      })
    });

    const data = await response.json();
    if (!response.ok) {
      const apiMessage = data?.error?.message || data?.message || `Gateway error: ${response.status}`;
      throw new Error(apiMessage);
    }

    // Gateway may return either OpenRouter-like shape or { content: "..." }.
    if (typeof data?.content === 'string' && data.content.trim()) {
      return {
        choices: [
          {
            message: {
              content: data.content.trim()
            }
          }
        ],
        gateway: true,
        raw: data
      };
    }

    return data;
  }

  async queryViaGatewayStream(requestBody, prompt, onToken) {
    const response = await fetch(this.gatewayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt,
        model: requestBody.model,
        requestBody
      })
    });

    return this.consumeStreamingResponse(response, onToken, 'Gateway');
  }

  async consumeStreamingResponse(response, onToken, sourceLabel) {
    if (!response.ok) {
      let errorMessage = `${sourceLabel} error: ${response.status}`;
      try {
        const data = await response.json();
        errorMessage = data?.error?.message || data?.message || errorMessage;
      } catch (_error) {
        const text = await response.text().catch(() => '');
        if (text.trim()) {
          errorMessage = text.trim();
        }
      }
      throw new Error(errorMessage);
    }

    if (!response.body) {
      throw new Error('Streaming not supported by this browser');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const rawEvents = [];
    let content = '';
    let buffer = '';

    const applyEvent = parsed => {
      if (!parsed || typeof parsed !== 'object') {
        return;
      }

      rawEvents.push(parsed);
      const errorMessage = parsed?.error?.message || parsed?.message;
      if (typeof errorMessage === 'string' && errorMessage.trim()) {
        const streamError = new Error(errorMessage.trim());
        streamError.raw = parsed;
        throw streamError;
      }

      const delta = parsed?.choices?.[0]?.delta?.content;
      if (typeof delta === 'string' && delta.length > 0) {
        content += delta;
        if (typeof onToken === 'function') {
          onToken(delta, content, parsed);
        }
        return;
      }

      const messageContent = parsed?.choices?.[0]?.message?.content;
      if (typeof messageContent === 'string' && messageContent.length > 0 && content.length === 0) {
        content = messageContent;
        if (typeof onToken === 'function') {
          onToken(messageContent, content, parsed);
        }
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) {
          continue;
        }

        const dataPart = trimmed.slice(5).trim();
        if (!dataPart || dataPart === '[DONE]') {
          continue;
        }

        let parsed = null;
        try {
          parsed = JSON.parse(dataPart);
        } catch (error) {
          // Ignore malformed chunks and continue consuming stream.
          continue;
        }

        applyEvent(parsed);
      }
    }

    if (buffer.trim().startsWith('data:')) {
      const dataPart = buffer.trim().slice(5).trim();
      if (dataPart && dataPart !== '[DONE]') {
        applyEvent(JSON.parse(dataPart));
      }
    }

    return {
      choices: [
        {
          message: {
            content
          }
        }
      ],
      stream: true,
      raw: rawEvents
    };
  }

  extractContent(data) {
    const message = data?.choices?.[0]?.message;
    const content = message?.content;

    if (typeof content === 'string' && content.trim()) {
      return content.trim();
    }

    if (Array.isArray(content)) {
      const text = content
        .map(item => {
          if (typeof item === 'string') {
            return item;
          }
          if (item?.type === 'text' && typeof item.text === 'string') {
            return item.text;
          }
          return '';
        })
        .join('\n')
        .trim();

      if (text) {
        return text;
      }
    }

    const fallback = data?.choices?.[0]?.text;
    if (typeof fallback === 'string' && fallback.trim()) {
      return fallback.trim();
    }

    // Deliberately NOT falling back to message.reasoning here. Reasoning is
    // the model's internal scratchpad; surfacing it would render planning text
    // ("Analyze User Input: ...") as the answer. Treating it as absent instead
    // lets query() see an empty reply and retry on the next model, which is
    // the outcome we want when a reasoning model burns max_tokens on thinking.

    if (Array.isArray(message?.tool_calls) && message.tool_calls.length > 0) {
      return JSON.stringify(message.tool_calls, null, 2);
    }

    return '';
  }

  _buildPrompt(question, context) {
    return `${question}\n\nContext: ${context}`;
  }
}
