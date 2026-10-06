// Exercises the Q4/Q5 handlers against the real prompts they build,
// with the API call stubbed so no network or key is needed.

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'src/app.js'), 'utf8');
const classStart = src.indexOf('class ChineseQAApp');
const classEnd = src.indexOf('// Init when DOM ready');

// Minimal DOM stand-ins for the fields the handlers read.
const fields = {
  'q4-sentence': { value: '我的朋友很矮' },
  'q4-tone': { value: 'respectful' },
  'q5-word': { value: '矮' },
  'q5-sentence': { value: '我的朋友很矮' }
};

global.document = {
  addEventListener: () => {},
  getElementById: id => (id in fields ? fields[id] : null),
  querySelectorAll: () => [],
  querySelector: () => null
};
global.window = { CONFIG: {} };

const ChineseQAApp = eval(src.slice(classStart, classEnd) + '; ChineseQAApp');

const app = Object.create(ChineseQAApp.prototype);
const captured = [];
app.submitQuery = async (question, source, context) => {
  captured.push({ question, source, context });
};
app.showResponse = () => {};

let failures = 0;
function expect(label, condition, detail) {
  if (!condition) {
    failures += 1;
  }
  console.log(`${condition ? '✓ Pass' : '✗ FAIL'}: ${label}`);
  if (!condition && detail) {
    console.log(`    ${detail}`);
  }
}

(async () => {
  await app.handleQuestion4();
  await app.handleQuestion5();

  const q4 = captured.find(c => c.source === 'Q4');
  const q5 = captured.find(c => c.source === 'Q5');

  expect('Q4 submitted', Boolean(q4));
  expect('Q5 submitted', Boolean(q5));

  expect('Q4 embeds the sentence', q4.question.includes('我的朋友很矮'), q4.question);
  expect('Q4 embeds the selected tone', q4.question.includes('respectful'), q4.question);
  expect('Q4 passes sentence as context', q4.context === '我的朋友很矮');

  expect('Q5 embeds the word', q5.question.includes('"矮"'), q5.question);
  expect('Q5 embeds the sentence', q5.question.includes('我的朋友很矮'), q5.question);
  expect('Q5 asks for several alternatives', /several/i.test(q5.question));
  expect('Q5 has no duplicated "instead of"', !/instead of instead of/i.test(q5.question));
  expect('Q5 passes sentence as context', q5.context === '我的朋友很矮');

  // The dropdown value must flow into the prompt, not a hardcoded default.
  fields['q4-tone'].value = 'angrier';
  captured.length = 0;
  await app.handleQuestion4();
  expect(
    'Q4 respects a changed tone selection',
    captured[0].question.includes('angrier') && !captured[0].question.includes('respectful'),
    captured[0].question
  );

  // Missing input must be rejected before any request is made.
  captured.length = 0;
  let showedError = false;
  app.showResponse = (_msg, isError) => { showedError = Boolean(isError); };
  fields['q4-sentence'].value = '   ';
  await app.handleQuestion4();
  expect('Q4 rejects an empty sentence', captured.length === 0 && showedError);

  fields['q4-sentence'].value = '我的朋友很矮';
  fields['q5-word'].value = '';
  captured.length = 0;
  await app.handleQuestion5();
  expect('Q5 rejects an empty word', captured.length === 0 && showedError);

  if (failures > 0) {
    console.log(`\n=== ${failures} test(s) FAILED ===`);
    process.exit(1);
  }
  console.log('\n=== All Tests Pass ===');
})();