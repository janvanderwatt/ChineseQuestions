// Configuration template
// Copy to config.js and fill in your OpenRouter API key

window.CONFIG = {
  OPENROUTER_API_KEY: '',

  // Model used for every query. These are cheap paid Chinese-native models
  // (about $0.0008 per question), verified against tricky grammar sentences:
  //   z-ai/glm-4.5-air   primary; $0.13/$0.85 per M tokens, 99.9%+ uptime
  //   tencent/hy3        backup;  $0.13/$0.53 per M tokens
  // Free (":free") slugs are cheaper still, but the free roster has no
  // Chinese-native model left and drops models every few weeks.
  OPENROUTER_MODEL: 'z-ai/glm-4.5-air',

  // Tried in order when a model hits a rate limit or upstream error.
  OPENROUTER_MODEL_FALLBACKS: ['tencent/hy3'],

  API_BASE: 'https://openrouter.ai/api/v1',
  GATEWAY_URL: '/api/openrouter-gateway.php' // server-side PHP proxy endpoint
};
