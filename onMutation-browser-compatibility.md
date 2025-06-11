# Browser Compatibility: Array.isArray Fallback

## The Issue

`Array.isArray()` was introduced in ECMAScript 5.1 (2011) and has the following browser support:
- **Chrome**: 5+ ✅
- **Firefox**: 4+ ✅
- **Safari**: 5+ ✅
- **Internet Explorer**: 9+ ✅
- **Edge**: All versions ✅

However, for maximum compatibility (especially IE8 and below), we need a fallback.

## Solution Options

### Option 1: Robust Fallback Function (Recommended)

```typescript
// In rrweb's observer.ts
function isArray(value: unknown): value is unknown[] {
  if (typeof Array.isArray === 'function') {
    return Array.isArray(value);
  }
  // Fallback for older browsers
  return Object.prototype.toString.call(value) === '[object Array]';
}

const observer = new (mutationObserverCtor as new (
  callback: MutationCallback,
) => MutationObserver)(
  callbackWrapper((mutations) => {
    if (options.onMutation) {
      const result = options.onMutation(mutations);
      if (result === false) {
        return;
      }
      // Use our robust array check
      if (isArray(result)) {
        mutationBuffer.processMutations.bind(mutationBuffer)(result);
        return;
      }
    }
    mutationBuffer.processMutations.bind(mutationBuffer)(mutations);
  }),
);
```

### Option 2: Inline Fallback

```typescript
const observer = new (mutationObserverCtor as new (
  callback: MutationCallback,
) => MutationObserver)(
  callbackWrapper((mutations) => {
    if (options.onMutation) {
      const result = options.onMutation(mutations);
      if (result === false) {
        return;
      }

      // Inline compatibility check
      const isResultArray = typeof Array.isArray === 'function'
        ? Array.isArray(result)
        : Object.prototype.toString.call(result) === '[object Array]';

      if (isResultArray) {
        mutationBuffer.processMutations.bind(mutationBuffer)(result);
        return;
      }
    }
    mutationBuffer.processMutations.bind(mutationBuffer)(mutations);
  }),
);
```

### Option 3: Polyfill Approach

```typescript
// At the top of observer.ts or in a utilities file
if (!Array.isArray) {
  Array.isArray = function(value: unknown): value is unknown[] {
    return Object.prototype.toString.call(value) === '[object Array]';
  };
}

// Then use Array.isArray normally
const observer = new (mutationObserverCtor as new (
  callback: MutationCallback,
) => MutationObserver)(
  callbackWrapper((mutations) => {
    if (options.onMutation) {
      const result = options.onMutation(mutations);
      if (result === false) {
        return;
      }
      if (Array.isArray(result)) {
        mutationBuffer.processMutations.bind(mutationBuffer)(result);
        return;
      }
    }
    mutationBuffer.processMutations.bind(mutationBuffer)(mutations);
  }),
);
```

### Option 4: Duck Typing Approach

```typescript
// Check for array-like properties instead
function isArrayLike(value: unknown): value is unknown[] {
  return value != null &&
         typeof value === 'object' &&
         typeof (value as any).length === 'number' &&
         typeof (value as any).splice === 'function';
}

const observer = new (mutationObserverCtor as new (
  callback: MutationCallback,
) => MutationObserver)(
  callbackWrapper((mutations) => {
    if (options.onMutation) {
      const result = options.onMutation(mutations);
      if (result === false) {
        return;
      }
      if (isArrayLike(result)) {
        mutationBuffer.processMutations.bind(mutationBuffer)(result);
        return;
      }
    }
    mutationBuffer.processMutations.bind(mutationBuffer)(mutations);
  }),
);
```

## Recommended Implementation

**Option 1 (Robust Fallback Function)** is recommended because:

1. **Most reliable**: `Object.prototype.toString.call()` is the most accurate way to detect arrays
2. **Cross-frame safe**: Works with arrays from different iframes/contexts
3. **Clean code**: Separates the compatibility logic
4. **Reusable**: Can be used elsewhere in the codebase
5. **TypeScript friendly**: Provides proper type guards

## Alternative: Feature Detection

If you want to be extra conservative, you could detect the feature and adjust behavior:

```typescript
const supportsArrayIsArray = typeof Array.isArray === 'function';
const supportsArrayMethods = typeof Array.prototype.splice === 'function';

if (!supportsArrayIsArray || !supportsArrayMethods) {
  // Log warning or use different strategy
  console.warn('rrweb: Array methods not fully supported, using basic array detection');
}

function detectArray(value: unknown): boolean {
  if (supportsArrayIsArray) {
    return Array.isArray(value);
  }
  if (value && typeof value === 'object' && supportsArrayMethods) {
    return typeof (value as any).length === 'number' &&
           typeof (value as any).splice === 'function';
  }
  return Object.prototype.toString.call(value) === '[object Array]';
}
```

## Testing Compatibility

```typescript
// Test suite for array detection
function testArrayDetection() {
  const testCases = [
    [[], true],
    [new Array(), true],
    [Array(5), true],
    [{}, false],
    [null, false],
    [undefined, false],
    ['array', false],
    [{ length: 0, splice: () => {} }, false], // Array-like but not array
    [arguments, false], // Arguments object
  ];

  testCases.forEach(([value, expected]) => {
    const result = isArray(value);
    console.assert(result === expected, `Array detection failed for ${value}`);
  });
}
```

## Performance Considerations

The `Object.prototype.toString.call()` method is:
- **Fast**: Negligible performance impact
- **Reliable**: Works consistently across all JavaScript environments
- **Safe**: No side effects or prototype pollution issues

The overhead of the compatibility check is minimal and only occurs when `onMutation` returns a value.

## Browser Support Matrix

| Method | IE6-8 | IE9+ | Modern Browsers |
|--------|-------|------|-----------------|
| `Array.isArray()` | ❌ | ✅ | ✅ |
| `Object.prototype.toString.call()` | ✅ | ✅ | ✅ |
| `instanceof Array` | ⚠️* | ⚠️* | ⚠️* |
| Duck typing | ✅ | ✅ | ✅ |

*`instanceof Array` fails with cross-frame arrays

## Final Recommendation

Use **Option 1** with the robust fallback function for the best balance of reliability, performance, and maintainability:

```typescript
function isArray(value: unknown): value is unknown[] {
  if (typeof Array.isArray === 'function') {
    return Array.isArray(value);
  }
  return Object.prototype.toString.call(value) === '[object Array]';
}
```

This ensures the onMutation enhancement works reliably across all JavaScript environments while maintaining clean, readable code.
