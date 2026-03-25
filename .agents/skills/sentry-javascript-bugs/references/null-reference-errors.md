# Null Reference Error Patterns

## Contents

- Overview
- Real examples
- Detection checklist

## Overview

Null/undefined property access is the single most common bug pattern in the Sentry JavaScript frontend, accounting for 158 issues and 46,337 events. These are TypeErrors where code accesses a property (`.id`, `.slug`, `.charCodeAt`, `.match`, `.dispatchEvent`, etc.) on a value that is null or undefined.

The most common sources of null values:

1. **API response fields** that are optional but treated as required
2. **Store/hook return values** during loading states (before data is hydrated)
3. **DOM element lookups** (`querySelector`, `useRef`) on unmounted elements
4. **Function parameters** from callers that pass null/undefined for edge cases
5. **Destructured objects** where the parent object may be null

## Real Examples

### [JAVASCRIPT-2NQW]: TypeError: null is not an object (evaluating 'e.charCodeAt') (resolved)

**Stacktrace:**

```
./app/views/insights/common/components/tableCells/spanDescriptionCell.tsx
  SpanDescriptionCell (line 39)
    const formatterDescription = useMemo(() => {
      return formatter.toSimpleMarkup(rawDescription);  // rawDescription is null
    }, [moduleName, rawDescription, spanAction, system]);

./app/utils/sqlish/SQLishFormatter.tsx
  SQLishFormatter.toFormat (line 49)
    tokens = sqlishParser.parse(sql);  // sql is null

./app/utils/sqlish/sqlish.pegjs
  eI (line 505)
    if (input.charCodeAt(peg$currPos) === 40) {  // input is null
```

**Root cause:** `SpanDescriptionCell` passes `rawDescription` to the SQL parser without checking if it is null. Span descriptions can be null for internal spans or spans with redacted data. The null check at line 51 (`if (!rawDescription) return NULL_DESCRIPTION`) executes after the `useMemo`, not inside it.

**Fix pattern:**

```typescript
const formatterDescription = useMemo(() => {
  if (!rawDescription) return NULL_DESCRIPTION;
  if (moduleName !== ModuleName.DB) return rawDescription;
  return formatter.toSimpleMarkup(rawDescription);
}, [moduleName, rawDescription, spanAction, system]);
```

### [JAVASCRIPT-361B]: TypeError: Invalid alert variant, got undefined (resolved)

**Stacktrace:**

```
./app/components/core/alert/alert.chonk.tsx
  tokens function
    throws TypeError("Invalid alert variant, got undefined")
```

**Root cause:** The Alert component receives an undefined `variant` prop. The chonk token function validates the variant but does not provide a default.

**Fix pattern:**

```typescript
const resolvedVariant = variant ?? 'info';
```

### [JAVASCRIPT-36F2]: Cannot read properties of undefined (reading 'match') (resolved)

**Stacktrace:**

```
./app/utils/discover/fields.tsx
  parseFunction
    field.match(AGGREGATE_PATTERN)  // field is undefined
```

**Root cause:** `parseFunction` is called with an undefined field value from a dashboard widget whose query references a field that no longer exists.

**Fix pattern:**

```typescript
function parseFunction(field: string): ParsedFunction | null {
  if (!field) return null;
  const match = field.match(AGGREGATE_PATTERN);
  // ...
}
```

### [JAVASCRIPT-34ZH]: Cannot read properties of null (reading 'id') (resolved)

**Stacktrace:**

```
./app/views/issueList/issueViews/useSelectedGroupSeachView.tsx
  matchingView
    view.id  // view is null (no matching saved view)
```

**Root cause:** Hook returns null when no matching saved view exists, but downstream code accesses `.id` without a null check.

**Fix pattern:**

```typescript
const viewId = matchingView?.id;
```

## Detection Checklist

- [ ] Does the code access properties on API response data without null checks?
- [ ] Are function parameters validated before use (especially string methods like `.match()`, `.charCodeAt()`)?
- [ ] Do `useMemo`/`useCallback` callbacks check for null inputs before processing?
- [ ] Are DOM element refs checked for null before accessing properties?
- [ ] Do hook return values have null guards before property access?
- [ ] Are store values checked during loading/initialization states?
- [ ] Does destructured data handle the case where the parent object is null?
- [ ] Are optional props given default values in component signatures?
