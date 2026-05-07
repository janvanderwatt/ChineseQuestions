// OpenRouter API wrapper

// Fallback config if config.js is missing.
window.CONFIG = window.CONFIG || {
  OPENROUTER_API_KEY: '',
  OPENROUTER_MODEL: 'openrouter/auto',
  API_BASE: 'https://openrouter.ai/api/v1',
  GATEWAY_URL: '/api/openrouter-gateway.php'
};

class ChineseQAAPI {
  constructor(apiKey = '') {
    this.apiKey = apiKey;
    this.baseUrl = window.CONFIG.API_BASE;
    this.gatewayUrl = window.CONFIG.GATEWAY_URL || '/api/openrouter-gateway.php';
    this.model = window.CONFIG.OPENROUTER_MODEL === 'openrouter/auto'
      ? 'openai/gpt-4.1-mini'
      : window.CONFIG.OPENROUTER_MODEL;
  }

  setApiKey(apiKey = '') {
    this.apiKey = apiKey;
  }

  getMode() {
    return this.apiKey ? 'direct' : 'gateway';
  }

  async query(question, context = '') {
    const prompt = this._buildPrompt(question, context);
    const requestBody = {
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful English-speaking Chinese language tutor. Explain in simple English with practical examples. Keep answers concise and clear. Look out for mistakes from the user using a character that sounds like another one that they probably confused, or a phrase that is commonly misused. If the user asks about a sentence, analyze it and point out any unnatural parts and suggest improvements. If the user is asking about a character, explain its meaning and usage in the context of the sentence. If the user is asking about a phrase, explain why it is incorrect and what the correct phrase should be, along with examples. Always provide clear explanations and practical examples to help the user understand Chinese better.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 700
    };

    const useDirect = Boolean(this.apiKey);

    try {
      const data = useDirect
        ? await this.queryDirect(requestBody)
        : await this.queryViaGateway(requestBody, prompt);

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
        mode: useDirect ? 'direct' : 'gateway',
        raw: data
      };
    } catch (err) {
      const wrappedError = new Error(`API failed: ${err.message}`);
      if (err.raw) {
        wrappedError.raw = err.raw;
      }
      throw wrappedError;
    }
  }

  async queryDirect(requestBody) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    if (!response.ok) {
      const apiMessage = data?.error?.message || data?.message || `API error: ${response.status}`;
      throw new Error(apiMessage);
    }

    return data;
  }

  async queryViaGateway(requestBody, prompt) {
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

    const reasoning = message?.reasoning || message?.reasoning_text || data?.choices?.[0]?.reasoning;
    if (typeof reasoning === 'string' && reasoning.trim()) {
      return reasoning.trim();
    }

    if (Array.isArray(message?.tool_calls) && message.tool_calls.length > 0) {
      return JSON.stringify(message.tool_calls, null, 2);
    }

    return '';
  }

  _buildPrompt(question, context) {
    return `${question}\n\nContext: ${context}`;
  }
}
