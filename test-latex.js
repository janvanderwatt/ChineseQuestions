// Unit tests for LaTeX symbol normalization in rendered answers.
//
// The free models sometimes emit LaTeX for plain symbols (e.g. "$\rightarrow$"
// instead of the arrow character). ChineseQAApp.normalizeLatexSymbols converts
// those to Unicode before markdown formatting runs.

console.log('=== LaTeX Symbol Normalization Tests ===\n');

// Load the real method from src/app.js rather than re-implementing it, so this
// test breaks if the implementation drifts. app.js touches `document` at load
// time, so stub the bits it needs and strip the trailing bootstrap listener.
const fs = require('fs');
const path = require('path');

const appSource = fs.readFileSync(path.join(__dirname, 'src/app.js'), 'utf8');
const classStart = appSource.indexOf('class ChineseQAApp');
const classEnd = appSource.indexOf('// Init when DOM ready');
if (classStart === -1 || classEnd === -1) {
  console.error('Could not locate ChineseQAApp class in src/app.js');
  process.exit(1);
}

// The constructor calls init(); give it no-op DOM lookups.
global.document = {
  addEventListener: () => {},
  getElementById: () => null,
  querySelectorAll: () => [],
  querySelector: () => null
};
global.window = { CONFIG: {} };

const ChineseQAApp = eval(
  appSource.slice(classStart, classEnd) + '; ChineseQAApp'
);

const app = Object.create(ChineseQAApp.prototype);
const norm = input => app.normalizeLatexSymbols(input);

let failures = 0;

function check(label, input, expected) {
  const actual = norm(input);
  const pass = actual === expected;
  if (!pass) {
    failures += 1;
  }
  console.log(`${pass ? '✓ Pass' : '✗ FAIL'}: ${label}`);
  if (!pass) {
    console.log(`    input:    ${JSON.stringify(input)}`);
    console.log(`    expected: ${JSON.stringify(expected)}`);
    console.log(`    actual:   ${JSON.stringify(actual)}`);
  }
  console.log('');
}

// The exact string reported from the gemma output.
check(
  'inline arrow in a list item',
  'Example: **向左** (xiàng zuǒ) = Towards the left $\\rightarrow$',
  'Example: **向左** (xiàng zuǒ) = Towards the left →'
);

check(
  'bolded arrow symbol',
  '*   **$\\rightarrow$** (Right arrow)',
  '*   **→** (Right arrow)'
);

check(
  'multiple symbols across one line',
  '$\\leftarrow$ and $\\rightarrow$ and $\\approx$',
  '← and → and ≈'
);

check(
  'comparison operators',
  'a $\\leq$ b $\\geq$ c $\\neq$ d $\\pm$ e',
  'a ≤ b ≥ c ≠ d ± e'
);

check(
  'text wrapper unwrapped',
  '$\\text{very tall}$ means 很高',
  'very tall means 很高'
);

check(
  'boxed unwrapped',
  '$\\boxed{我的朋友很高}$',
  '我的朋友很高'
);

check(
  'color command dropped, content kept',
  '$\\color{red}{不对}$',
  '不对'
);

check(
  'unknown command loses backslash only',
  '$\\foo{x}$',
  'foox'
);

check(
  'plain text is untouched, spacing preserved',
  'keeps  double  spaces and trailing ',
  'keeps  double  spaces and trailing '
);

check(
  'text with no dollar sign is byte-identical',
  '很 means "very" in Chinese.',
  '很 means "very" in Chinese.'
);

check(
  'markdown bold/italic syntax survives normalization',
  '**我的朋友很矮** [*Wǒ de péngyǒu hěn ǎi*]',
  '**我的朋友很矮** [*Wǒ de péngyǒu hěn ǎi*]'
);

check(
  'empty string',
  '',
  ''
);

check(
  'non-string returns unchanged',
  null,
  null
);

if (failures > 0) {
  console.log(`=== ${failures} test(s) FAILED ===`);
  process.exit(1);
}

console.log('=== All Tests Pass ===');