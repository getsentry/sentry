# onMutation Enhancement: Pre-processing Mutations

This guide outlines the changes needed to enhance the `onMutation` callback to support pre-processing mutations while maintaining backwards compatibility.

## Overview

The enhancement allows `onMutation` to:
1. **Backwards Compatible**: Return `false` to skip processing mutations (existing behavior)
2. **Backwards Compatible**: Return `undefined`/`void` to process mutations normally (existing behavior)
3. **New Feature**: Return an array of mutations to use as pre-processed mutations

## Required Changes

### 1. rrweb observer.ts Changes

**File**: `packages/rrweb/src/record/observer.ts`

**Current Implementation**:
```typescript
const observer = new (mutationObserverCtor as new (
  callback: MutationCallback,
) => MutationObserver)(
  callbackWrapper((mutations) => {
    // If this callback returns `false`, we do not want to process the mutations
    // This can be used to e.g. do a manual full snapshot when mutations become too large, or similar.
    if (options.onMutation && options.onMutation(mutations) === false) {
      return;
    }
    mutationBuffer.processMutations.bind(mutationBuffer)(mutations);
  }),
);
```

**Enhanced Implementation with Browser Compatibility**:
```typescript
// Browser-compatible array detection
function isArray(value: unknown): value is unknown[] {
  if (typeof Array.isArray === 'function') {
    return Array.isArray(value);
  }
  // Fallback for older browsers (IE8 and below)
  return Object.prototype.toString.call(value) === '[object Array]';
}

const observer = new (mutationObserverCtor as new (
  callback: MutationCallback,
) => MutationObserver)(
  callbackWrapper((mutations) => {
    // If this callback returns `false`, we do not want to process the mutations
    // This can be used to e.g. do a manual full snapshot when mutations become too large, or similar.
    // If it returns an array, we use that as the pre-processed mutations.
    if (options.onMutation) {
      const result = options.onMutation(mutations);
      if (result === false) {
        return;
      }
      // Use browser-compatible array check
      if (isArray(result)) {
        mutationBuffer.processMutations.bind(mutationBuffer)(result);
        return;
      }
    }
    mutationBuffer.processMutations.bind(mutationBuffer)(mutations);
  }),
);
```

### 2. Type Definition Updates

**File**: `packages/rrweb-snapshot/src/types.ts` (or similar type file)

**Current Type**:
```typescript
export type onMutationCallback = (
  mutations: mutationRecord[]
) => boolean | void;
```

**Enhanced Type**:
```typescript
export type onMutationCallback = (
  mutations: mutationRecord[]
) => boolean | void | mutationRecord[];
```

### 3. Browser Compatibility Details

The enhanced implementation uses a robust array detection method that works across all browsers:

- **Modern Browsers** (Chrome 5+, Firefox 4+, Safari 5+, IE9+): Uses native `Array.isArray()`
- **Legacy Browsers** (IE8 and below): Falls back to `Object.prototype.toString.call()`
- **Cross-frame Safe**: Works with arrays from different iframes/contexts
- **Performance**: Negligible overhead, only checks when `onMutation` returns a value

### 4. Usage Examples

#### Backwards Compatible Usage

```javascript
// Skip processing large mutation batches (existing behavior)
const replayOptions = {
  onMutation: (mutations) => {
    if (mutations.length > 1000) {
      return false; // Skip processing
    }
    // Return undefined/void to process normally
  }
};
```

#### New Pre-processing Usage

```javascript
// Filter out sensitive mutations
const replayOptions = {
  onMutation: (mutations) => {
    // Pre-process mutations by filtering
    return mutations.filter(mutation => {
      // Skip mutations from elements with sensitive data
      const target = mutation.target as Element;
      return !target?.classList?.contains('sensitive-data');
    });
  }
};
```

```javascript
// Transform mutations before processing
const replayOptions = {
  onMutation: (mutations) => {
    // Transform mutations
    return mutations.map(mutation => {
      // Sanitize attribute changes
      if (mutation.type === 'attributes' && mutation.attributeName === 'data-sensitive') {
        return {
          ...mutation,
          oldValue: '[REDACTED]'
        };
      }
      return mutation;
    });
  }
};
```

#### Advanced Usage - Conditional Processing

```javascript
const replayOptions = {
  onMutation: (mutations) => {
    // Check if we should skip entirely
    if (shouldSkipMutations(mutations)) {
      return false;
    }

    // Check if we should process as-is
    if (shouldProcessNormally(mutations)) {
      return; // undefined - process normally
    }

    // Otherwise, pre-process
    return preprocessMutations(mutations);
  }
};

function shouldSkipMutations(mutations) {
  return mutations.length > 1000 ||
         mutations.some(m => m.target?.id === 'performance-critical-element');
}

function shouldProcessNormally(mutations) {
  return mutations.every(m => m.type === 'characterData');
}

function preprocessMutations(mutations) {
  return mutations
    .filter(m => !m.target?.classList?.contains('exclude-from-replay'))
    .map(sanitizeMutation);
}

function sanitizeMutation(mutation) {
  if (mutation.type === 'attributes' && mutation.attributeName?.startsWith('data-user-')) {
    return {
      ...mutation,
      oldValue: '[REDACTED]'
    };
  }
  return mutation;
}
```

## Integration with Sentry Replay

Once the rrweb changes are implemented, users can leverage this functionality in Sentry's replay integration:

```javascript
import * as Sentry from '@sentry/browser';

Sentry.init({
  dsn: 'YOUR_DSN',
  integrations: [
    Sentry.replayIntegration({
      // Configure rrweb recording options
      recordingOptions: {
        onMutation: (mutations) => {
          // Your pre-processing logic here
          return mutations.filter(mutation => {
            // Filter logic
            return !shouldExcludeMutation(mutation);
          });
        }
      }
    })
  ]
});
```

## Testing Strategy

### Unit Tests

```javascript
describe('onMutation pre-processing', () => {
  it('should maintain backwards compatibility with false return', () => {
    const onMutation = jest.fn().mockReturnValue(false);
    const processMutations = jest.fn();

    // Trigger mutations
    // Assert processMutations was not called
  });

  it('should maintain backwards compatibility with undefined return', () => {
    const onMutation = jest.fn().mockReturnValue(undefined);
    const processMutations = jest.fn();

    // Trigger mutations
    // Assert processMutations was called with original mutations
  });

  it('should use returned array as pre-processed mutations', () => {
    const processedMutations = [/* filtered mutations */];
    const onMutation = jest.fn().mockReturnValue(processedMutations);
    const processMutations = jest.fn();

    // Trigger mutations
    // Assert processMutations was called with processedMutations
  });

  it('should work with legacy browsers without Array.isArray', () => {
    // Mock legacy browser environment
    const originalArrayIsArray = Array.isArray;
    delete Array.isArray;

    const processedMutations = [/* mutations */];
    const onMutation = jest.fn().mockReturnValue(processedMutations);
    const processMutations = jest.fn();

    // Trigger mutations
    // Assert processMutations was called with processedMutations

    // Restore
    Array.isArray = originalArrayIsArray;
  });
});
```

### Browser Compatibility Tests

```javascript
describe('Array detection compatibility', () => {
  it('should detect arrays correctly across environments', () => {
    // Test cases for the isArray function
    expect(isArray([])).toBe(true);
    expect(isArray(new Array())).toBe(true);
    expect(isArray({})).toBe(false);
    expect(isArray(null)).toBe(false);
    expect(isArray('array')).toBe(false);
  });

  it('should work without Array.isArray', () => {
    const originalArrayIsArray = Array.isArray;
    delete Array.isArray;

    expect(isArray([])).toBe(true);
    expect(isArray({})).toBe(false);

    Array.isArray = originalArrayIsArray;
  });
});
```

### Integration Tests

```javascript
describe('Sentry Replay with onMutation', () => {
  it('should filter mutations in real replay scenario', async () => {
    // Set up replay with onMutation filter
    // Trigger DOM mutations
    // Assert filtered mutations are recorded
  });
});
```

## Implementation Notes

1. **Browser Compatibility**: The `Object.prototype.toString.call()` fallback works in all JavaScript environments
2. **Performance**: The enhancement adds minimal overhead as it only checks the return type
3. **Memory**: Pre-processing should be mindful of memory usage when creating new arrays
4. **Error Handling**: Consider wrapping `onMutation` calls in try-catch to prevent breaking recording
5. **Cross-frame Safety**: The implementation works with arrays from different iframes/contexts
6. **Documentation**: Update rrweb documentation to explain the new capability

## Browser Support Matrix

| Method | IE6-8 | IE9+ | Modern Browsers |
|--------|-------|------|-----------------|
| `Array.isArray()` | ❌ | ✅ | ✅ |
| `Object.prototype.toString.call()` | ✅ | ✅ | ✅ |
| Our Implementation | ✅ | ✅ | ✅ |

## Migration Path

1. Implement changes in rrweb with browser compatibility
2. Update rrweb version in Sentry replay integration
3. Add documentation and examples
4. Consider adding helper utilities for common filtering patterns

This enhancement provides powerful mutation pre-processing capabilities while maintaining full backwards compatibility with existing implementations and supporting all browsers.
