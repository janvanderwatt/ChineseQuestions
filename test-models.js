// Live model comparison for tricky Chinese sentences.
//
// Runs the app's own prompt (src/api.js) against each candidate model so the
// comparison reflects what users actually get, formatting rules included.
//
//   node test-models.js                 # default candidates
//   node test-models.js z-ai/glm-4.5-air tencent/hy3
//
// The key is read from config.js or OPENROUTER_API_KEY. It is never printed.

const fs = require('fs');
const vm = require('vm');

const DEFAULT_MODELS = ['z-ai/glm-4.5-air', 'tencent/hy3'];

// Each case is a sentence plus a one-line note on what a good answer must do.
// Mix of real errors and correct sentences: a model that "fixes" the correct
// ones is worse than one that simply explains them.
const CASES = [
  { text: '我比他很高。', expect: 'flag 比…很高 as wrong; 比 already has comparative force' },
  { text: '他高兴的跑了。', expect: 'flag 的 → 地 before a verb' },
  { text: '我是昨天来的。', expect: 'recognise 是…的 focus structure as correct' },
  { text: '我差点儿没赶上火车。', expect: 'explain 差点儿没 = almost missed; not a double-negative error' },
  { text: '我昨天没去了学校。', expect: 'flag 没…了 as incompatible; 没去' },
  { text: '他把书放桌子上了。', expect: 'flag missing 在 → 放在桌子上' },
  { text: '虽然下雨，但是他还是去了。', expect: 'treat as correct; 虽然…但是 pairing is fine' },
  { text: '我昨天去了北京，但是我以前没去过。', expect: 'explain 了 vs 过 contrast; no correction needed' }
];

function readKey() {
  if (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim()) {
    return process.env.OPENROUTER_API_KEY.trim();
  }
  for (const file of ['config.js', 'api/gateway-config.php']) {
    if (!fs.existsSync(file)) {
      continue;
    }
    const source = fs.readFileSync(file, 'utf8');
    const match = source.match(/OPENROUTER_API_KEY['"]?\s*(?::|=>|=)\s*['"]([^'"]+)['"]/);
    if (match && match[1].trim()) {
      return match[1].trim();
    }
  }
  return '';
}

function loadApi(apiKey) {
  const source = fs.readFileSync('src/api.js', 'utf8');
  const context = {
    console,
    setTimeout,
    clearTimeout,
    localStorage: { getItem: () => null, setItem: () => {} },
    fetch,
    TextDecoder,
    window: {}
  };
  context.window.CONFIG = {
    OPENROUTER_API_KEY: '',
    OPENROUTER_MODEL: DEFAULT_MODELS[0],
    OPENROUTER_MODEL_FALLBACKS: [],
    API_BASE: 'https://openrouter.ai/api/v1',
    GATEWAY_URL: '/api/openrouter-gateway.php'
  };
  vm.createContext(context);
  vm.runInContext(source + '\nthis.ChineseQAAPI = ChineseQAAPI;', context);
  return new context.ChineseQAAPI(apiKey);
}

async function main() {
  const apiKey = readKey();
  if (!apiKey) {
    console.error('No OpenRouter key found in config.js or OPENROUTER_API_KEY.');
    console.error('Put the key in config.js (git-ignored) and re-run; it will not be printed.');
    process.exit(2);
  }

  const models = process.argv.slice(2).filter(Boolean);
  const candidates = models.length > 0 ? models : DEFAULT_MODELS;
  const api = loadApi(apiKey);
  const results = [];

  for (const model of candidates) {
    api.models = [model];
    console.log(`\n=== ${model} ===`);
    for (const testCase of CASES) {
      const question = `Does this sentence sound natural? "${testCase.text}"`;
      const started = Date.now();
      try {
        const response = await api.query(question, '');
        const elapsed = Date.now() - started;
        results.push({ model, text: testCase.text, ok: true, elapsed, content: response.content });
        console.log(`\n--- ${testCase.text} (${elapsed} ms) ---`);
        console.log(`expected: ${testCase.expect}`);
        const shown = response.content.length > 1500
          ? `${response.content.slice(0, 1500)}\n[...trimmed, full text in model-check-results.json]`
          : response.content;
        console.log(shown);
      } catch (error) {
        results.push({ model, text: testCase.text, ok: false, error: error.message });
        console.log(`\n--- ${testCase.text} FAILED: ${error.message}`);
      }
    }
  }

  fs.writeFileSync('model-check-results.json', JSON.stringify(results, null, 2));
  console.log('\nWrote model-check-results.json');
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
