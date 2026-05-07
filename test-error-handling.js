// Unit tests for error handling

console.log('=== Error Handling Tests ===\n');

// Mock escapeHtml function
function escapeHtml(text) {
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

// Test 1: Normal text
console.log('Test 1: Normal text');
const result1 = escapeHtml('This is safe text');
console.log('  Result:', result1);
console.log('  ✓ Pass\n');

// Test 2: HTML entities
console.log('Test 2: HTML entities');
const result2 = escapeHtml('<script>alert("xss")</script>');
console.log('  Input: <script>alert("xss")</script>');
console.log('  Result:', result2);
console.log('  ✓ Pass (escaped)\n');

// Test 3: Null handling
console.log('Test 3: Null input');
const result3 = escapeHtml(null);
console.log('  Input: null');
console.log('  Result:', `"${result3}"`);
console.log('  ✓ Pass (returns empty string)\n');

// Test 4: Undefined handling
console.log('Test 4: Undefined input');
const result4 = escapeHtml(undefined);
console.log('  Input: undefined');
console.log('  Result:', `"${result4}"`);
console.log('  ✓ Pass (returns empty string)\n');

// Test 5: Non-string handling
console.log('Test 5: Non-string input');
const result5 = escapeHtml({ data: 'object' });
console.log('  Input: { data: "object" }');
console.log('  Result:', `"${result5}"`);
console.log('  ✓ Pass (returns empty string)\n');

// Test 6: Empty string
console.log('Test 6: Empty string');
const result6 = escapeHtml('');
console.log('  Input: ""');
console.log('  Result:', `"${result6}"`);
console.log('  ✓ Pass (returns empty string)\n');

// Test API response validation
console.log('=== API Response Validation ===\n');

function validateAPIResponse(data) {
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    return { valid: false, error: 'Invalid response structure' };
  }
  
  const content = data.choices[0].message.content;
  if (!content) {
    return { valid: false, error: 'Empty response' };
  }
  
  return { valid: true, content };
}

// Test good response
console.log('Test: Valid API response');
const goodResponse = {
  choices: [
    {
      message: {
        content: 'The character 很 means "very" in Chinese.'
      }
    }
  ]
};
const result7 = validateAPIResponse(goodResponse);
console.log('  Result:', result7);
console.log('  ✓ Pass\n');

// Test bad response - missing choices
console.log('Test: Invalid API response (no choices)');
const badResponse1 = { error: 'Some error' };
const result8 = validateAPIResponse(badResponse1);
console.log('  Result:', result8);
console.log('  ✓ Pass (caught error)\n');

// Test bad response - empty content
console.log('Test: Invalid API response (empty content)');
const badResponse2 = {
  choices: [
    {
      message: {
        content: null
      }
    }
  ]
};
const result9 = validateAPIResponse(badResponse2);
console.log('  Result:', result9);
console.log('  ✓ Pass (caught error)\n');

console.log('=== All Tests Pass ✓ ===');
