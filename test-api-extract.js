const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('src/api.js', 'utf8');
const context = {
  console,
  window: {},
  fetch: async () => ({ ok: true, json: async () => ({}) })
};
vm.createContext(context);
vm.runInContext(source + '\nthis.ChineseQAAPI = ChineseQAAPI;', context);

const api = new context.ChineseQAAPI('test');
const cases = [
  {
    name: 'string content',
    input: { choices: [{ message: { content: 'plain text' } }] },
    expected: 'plain text'
  },
  {
    name: 'array text content',
    input: { choices: [{ message: { content: [{ type: 'text', text: 'part 1' }, { type: 'text', text: 'part 2' }] } }] },
    expected: 'part 1\npart 2'
  },
  {
    name: 'legacy text fallback',
    input: { choices: [{ text: 'legacy text' }] },
    expected: 'legacy text'
  },
  {
    name: 'empty content',
    input: { choices: [{ message: { content: null } }] },
    expected: ''
  }
];

for (const testCase of cases) {
  const actual = api.extractContent(testCase.input);
  if (actual !== testCase.expected) {
    throw new Error(`${testCase.name}: expected ${JSON.stringify(testCase.expected)} got ${JSON.stringify(actual)}`);
  }
  console.log(`PASS ${testCase.name}`);
}
