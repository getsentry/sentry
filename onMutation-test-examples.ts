// Test examples for enhanced onMutation functionality
// These tests demonstrate the backwards compatibility and new pre-processing features

interface MockMutation {
  type: 'attributes' | 'characterData' | 'childList';
  target: {
    id?: string;
    classList?: {
      contains: (className: string) => boolean;
    };
  };
  attributeName?: string;
  oldValue?: string;
}

type OnMutationCallback = (mutations: MockMutation[]) => boolean | void | MockMutation[];

// Test: Backwards compatibility - returning false
function testBackwardsCompatibilityFalse() {
  console.log('Testing backwards compatibility: return false');

  const onMutation: OnMutationCallback = mutations => {
    if (mutations.length > 5) {
      return false; // Skip processing
    }
  };

  const mutations: MockMutation[] = Array(10).fill({
    type: 'childList',
    target: {id: 'test'},
  });

  const result = onMutation(mutations);
  console.log('Result:', result); // Should be false
  console.log('Expected behavior: Skip processing mutations\n');
}

// Test: Backwards compatibility - returning undefined
function testBackwardsCompatibilityUndefined() {
  console.log('Testing backwards compatibility: return undefined');

  const onMutation: OnMutationCallback = mutations => {
    console.log(`Processing ${mutations.length} mutations normally`);
    // Implicit return undefined
  };

  const mutations: MockMutation[] = [{type: 'characterData', target: {id: 'text-node'}}];

  const result = onMutation(mutations);
  console.log('Result:', result); // Should be undefined
  console.log('Expected behavior: Process original mutations\n');
}

// Test: New feature - returning filtered array
function testFilteringMutations() {
  console.log('Testing new feature: filtering mutations');

  const onMutation: OnMutationCallback = mutations => {
    // Filter out mutations from sensitive elements
    return mutations.filter(mutation => {
      return !mutation.target.classList?.contains('sensitive-data');
    });
  };

  const mutations: MockMutation[] = [
    {
      type: 'attributes',
      target: {
        id: 'normal-element',
        classList: {contains: className => className === 'normal'},
      },
    },
    {
      type: 'attributes',
      target: {
        id: 'sensitive-element',
        classList: {contains: className => className === 'sensitive-data'},
      },
    },
    {
      type: 'characterData',
      target: {
        id: 'text-element',
        classList: {contains: () => false},
      },
    },
  ];

  const result = onMutation(mutations);
  console.log('Original mutations:', mutations.length);
  console.log('Filtered mutations:', (result as MockMutation[]).length);
  console.log('Expected behavior: Filter out sensitive mutations\n');
}

// Test: New feature - transforming mutations
function testTransformingMutations() {
  console.log('Testing new feature: transforming mutations');

  const onMutation: OnMutationCallback = mutations => {
    // Sanitize sensitive attribute changes
    return mutations.map(mutation => {
      if (
        mutation.type === 'attributes' &&
        mutation.attributeName?.startsWith('data-user-')
      ) {
        return {
          ...mutation,
          oldValue: '[REDACTED]',
        };
      }
      return mutation;
    });
  };

  const mutations: MockMutation[] = [
    {
      type: 'attributes',
      target: {id: 'user-profile'},
      attributeName: 'data-user-email',
      oldValue: 'user@example.com',
    },
    {
      type: 'attributes',
      target: {id: 'public-element'},
      attributeName: 'class',
      oldValue: 'btn',
    },
  ];

  const result = onMutation(mutations) as MockMutation[];
  console.log('Original sensitive value:', mutations[0].oldValue);
  console.log('Transformed sensitive value:', result[0].oldValue);
  console.log('Public value unchanged:', result[1].oldValue);
  console.log('Expected behavior: Sanitize sensitive attributes\n');
}

// Test: Conditional processing
function testConditionalProcessing() {
  console.log('Testing conditional processing');

  const onMutation: OnMutationCallback = mutations => {
    // Skip if too many mutations
    if (mutations.length > 100) {
      return false;
    }

    // Process normally for character data
    if (mutations.every(m => m.type === 'characterData')) {
      return; // undefined - process normally
    }

    // Filter and transform for other types
    return mutations
      .filter(m => !m.target.id?.startsWith('temp-'))
      .map(m => ({
        ...m,
        oldValue: m.oldValue?.includes('sensitive') ? '[REDACTED]' : m.oldValue,
      }));
  };

  // Test case 1: Too many mutations
  const largeMutationSet: MockMutation[] = Array(150).fill({
    type: 'childList',
    target: {id: 'element'},
  });

  const result1 = onMutation(largeMutationSet);
  console.log('Large mutation set result:', result1); // Should be false

  // Test case 2: Character data only
  const characterMutations: MockMutation[] = [
    {type: 'characterData', target: {id: 'text1'}},
    {type: 'characterData', target: {id: 'text2'}},
  ];

  const result2 = onMutation(characterMutations);
  console.log('Character mutations result:', result2); // Should be undefined

  // Test case 3: Mixed mutations needing filtering
  const mixedMutations: MockMutation[] = [
    {type: 'attributes', target: {id: 'keep-this'}, oldValue: 'safe'},
    {type: 'attributes', target: {id: 'temp-element'}, oldValue: 'temporary'},
    {type: 'attributes', target: {id: 'another'}, oldValue: 'sensitive data'},
  ];

  const result3 = onMutation(mixedMutations) as MockMutation[];
  console.log('Mixed mutations - original count:', mixedMutations.length);
  console.log('Mixed mutations - filtered count:', result3.length);
  console.log(
    'Mixed mutations - sanitized values:',
    result3.map(m => m.oldValue)
  );
  console.log('Expected behavior: Filter temp elements and sanitize sensitive data\n');
}

// Enhanced mutation observer simulation
function simulateEnhancedMutationObserver() {
  console.log('=== Enhanced Mutation Observer Simulation ===\n');

  const processMutations = (mutations: MockMutation[]) => {
    console.log(`📝 Processing ${mutations.length} mutations:`);
    mutations.forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.type} on ${m.target.id || 'unknown'}`);
    });
    console.log('');
  };

  const createObserver = (onMutation?: OnMutationCallback) => {
    return (mutations: MockMutation[]) => {
      if (onMutation) {
        const result = onMutation(mutations);
        if (result === false) {
          console.log('🚫 Skipping mutation processing');
          return;
        }
        if (Array.isArray(result)) {
          console.log('🔄 Using pre-processed mutations');
          processMutations(result);
          return;
        }
      }
      console.log('✅ Processing original mutations');
      processMutations(mutations);
    };
  };

  // Example 1: Filter sensitive data
  console.log('Example 1: Filtering sensitive data');
  const observer1 = createObserver(mutations => {
    return mutations.filter(m => !m.target.classList?.contains('sensitive-data'));
  });

  observer1([
    {type: 'attributes', target: {id: 'public', classList: {contains: () => false}}},
    {
      type: 'attributes',
      target: {id: 'private', classList: {contains: c => c === 'sensitive-data'}},
    },
  ]);

  // Example 2: Skip large batches
  console.log('Example 2: Skipping large mutation batches');
  const observer2 = createObserver(mutations => {
    return mutations.length > 5 ? false : undefined;
  });

  observer2(Array(10).fill({type: 'childList', target: {id: 'element'}}));

  // Example 3: Normal processing
  console.log('Example 3: Normal processing');
  const observer3 = createObserver(mutations => {
    console.log('💭 Callback executed, returning undefined');
  });

  observer3([{type: 'characterData', target: {id: 'text'}}]);
}

// Run all tests
function runAllTests() {
  console.log('🧪 Running onMutation Enhancement Tests\n');

  testBackwardsCompatibilityFalse();
  testBackwardsCompatibilityUndefined();
  testFilteringMutations();
  testTransformingMutations();
  testConditionalProcessing();
  simulateEnhancedMutationObserver();

  console.log('✅ All tests completed!');
}

// Export for use in other files
export {
  testBackwardsCompatibilityFalse,
  testBackwardsCompatibilityUndefined,
  testFilteringMutations,
  testTransformingMutations,
  testConditionalProcessing,
  simulateEnhancedMutationObserver,
  runAllTests,
};

// Run tests if this file is executed directly
if (typeof window === 'undefined' && typeof module !== 'undefined') {
  runAllTests();
}
