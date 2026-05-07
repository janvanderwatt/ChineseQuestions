// OpenRouter API wrapper

class ChineseQAAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = CONFIG.API_BASE;
    this.model = CONFIG.OPENROUTER_MODEL;
  }

  async query(question, context = '') {
    const prompt = this._buildPrompt(question, context);
    
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful English-speaking Chinese language tutor. Explain in simple English with practical examples. Keep answers concise and clear.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 500
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (err) {
      throw new Error(`Failed to query API: ${err.message}`);
    }
  }

  _buildPrompt(question, context) {
    return `${question}\n\nContext: ${context}`;
  }
}
