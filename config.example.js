// Configuration template
// Copy to config.js and fill in your OpenRouter API key

window.CONFIG = {
  OPENROUTER_API_KEY: '',

  // Model used for every query. Free (":free") slugs keep the no-key
  // gateway path from spending credits. Verified good for Chinese:
  //   google/gemma-4-26b-a4b-it:free        best Chinese quality, no reasoning overhead
  //   nvidia/nemotron-3-super-120b-a12b:free  fastest, good fallback
  //   dots-studio/dots-3-note-preview:free   strong Chinese, verbose
  // Set a paid slug here if you prefer quality over cost.
  OPENROUTER_MODEL: 'google/gemma-4-26b-a4b-it:free',

  // Tried in order when a model hits a rate limit or upstream error.
  OPENROUTER_MODEL_FALLBACKS: ['nvidia/nemotron-3-super-120b-a12b:free'],

  API_BASE: 'https://openrouter.ai/api/v1',
  GATEWAY_URL: '/api/openrouter-gateway.php' // server-side PHP proxy endpoint
};
