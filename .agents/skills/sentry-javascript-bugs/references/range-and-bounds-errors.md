# Range & Bounds Error Patterns

## Contents

- Overview
- Real examples
- Detection checklist

## Overview

Range and bounds errors account for 15 issues and 3,120 events. These are RangeErrors from array operations with invalid lengths, numeric formatting with out-of-range parameters, invalid Date construction, and stack overflows from deep recursion.

Key sub-patterns:

1. **Invalid array length** (2.9K events): `push(...spread)` on large arrays
2. **Stack overflow** (99 events): Deep recursion in tree rendering
3. **Invalid time values** (60 events): Bad timestamps passed to Date constructor
4. **Numeric formatting** (24 events): `maximumFractionDigits` out of range

## Real Examples

### [JAVASCRIPT-35NH]: RangeError: Invalid array length (resolved)

**Sentry**: https://sentry.io/issues/7121413975/
**Events**: 911 | **Users**: 674

**Stacktrace:**

```
Array.push (native)
```

**Root cause:** Code uses `result.push(...spans)` where `spans` is a very large array. When the combined size exceeds JavaScript's max array length, `push` with spread throws a RangeError. This occurs when processing traces with thousands of spans.

**Fix pattern:**

```typescript
// Before (crashes on large arrays)
result.push(...spans);

// After (safe for any size)
for (const span of spans) {
  result.push(span);
}
// Or: result = result.concat(spans);
```

**Actual fix:** Resolved (replaced spread with iterative push or concat).

### [JAVASCRIPT-358Q]: RangeError: maximumFractionDigits out of range (resolved)

**Sentry**: https://sentry.io/issues/7130310735/
**Events**: 24 | **Users**: 4

**Root cause:** `Number.toLocaleString()` receives a `maximumFractionDigits` value outside the valid range (0-100). The precision is dynamically computed (e.g., `Math.ceil(-Math.log10(value))`) and can produce negative values or values exceeding 100 for extreme inputs.

**Fix pattern:**

```typescript
const precision = Math.min(100, Math.max(0, computedPrecision));
value.toLocaleString(undefined, {maximumFractionDigits: precision});
```

**Actual fix:** Resolved (clamped the precision value).

### [JAVASCRIPT-2WVR]: RangeError: Maximum call stack size exceeded (unresolved)

**Sentry**: https://sentry.io/issues/5816316247/
**Events**: 56 | **Users**: 12

**Root cause:** Stack overflow from deep recursion when rendering deeply nested data structures (trace trees, nested groups). The browser's call stack limit is exceeded.

**Fix pattern:** Convert recursive rendering to iterative with an explicit stack.

```typescript
// Before (recursive)
function renderNode(node: TreeNode): JSX.Element {
  return <div>{node.children.map(child => renderNode(child))}</div>;
}

// After (iterative)
function renderTree(root: TreeNode): JSX.Element[] {
  const result: JSX.Element[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    result.push(<div key={node.id}>{node.label}</div>);
    stack.push(...node.children);
  }
  return result;
}
```

## Detection Checklist

- [ ] Is `Array.push(...spread)` used on potentially large arrays?
- [ ] Are numeric formatting parameters (fraction digits, significant digits) clamped to valid ranges?
- [ ] Are Date objects constructed from validated timestamps?
- [ ] Is there recursive rendering of user-controlled data structures?
- [ ] Are recursive functions guarded with depth limits?
- [ ] Is `toLocaleString` called with computed precision values?
