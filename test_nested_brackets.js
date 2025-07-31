// Test nested bracket flattening functionality
function flattenNestedBrackets(value) {
  if (!/^\[.*\]$/.test(value)) {
    return value;
  }
  
  // Remove outer brackets to work with the inner content
  const inner = value.slice(1, -1);
  
  // Find and flatten nested brackets
  let flattened = inner;
  
  // Simple approach: replace [content] with just content within the array
  // This handles cases like [test,[test2]] -> [test,test2]
  flattened = flattened.replace(/\[([^\[\]]*)\]/g, '$1');
  
  return `[${flattened}]`;
}

// Test cases for nested bracket flattening
const testCases = [
  {
    input: '[test,[test2]]',
    expected: '[test,test2]',
    description: 'Simple nested brackets'
  },
  {
    input: '[alpha,beta]',
    expected: '[alpha,beta]',
    description: 'No nested brackets (should remain unchanged)'
  },
  {
    input: '[test,[test2],[test3]]',
    expected: '[test,test2,test3]',
    description: 'Multiple nested brackets'
  },
  {
    input: 'not-brackets',
    expected: 'not-brackets',
    description: 'Non-bracket input (should remain unchanged)'
  }
];

console.log('Testing nested bracket flattening...\n');

testCases.forEach((testCase, index) => {
  const result = flattenNestedBrackets(testCase.input);
  const passed = result === testCase.expected;
  
  console.log(`Test ${index + 1}: ${passed ? '✅' : '❌'} ${testCase.description}`);
  console.log(`  Input:    ${testCase.input}`);
  console.log(`  Expected: ${testCase.expected}`);
  console.log(`  Got:      ${result}`);
  console.log('');
});

console.log('Flattening logic verification complete!');