# React Lifecycle Error Patterns

## Contents

- Overview
- Real examples
- Detection checklist

## Overview

React lifecycle errors account for 10 issues and 2,595 events. These are violations of React's rendering rules that cause infinite loops, crashes, or context errors. Three main sub-patterns:

1. **Infinite re-render loops** (2.3K events): Components set state unconditionally in effects
2. **Missing context providers** (90 events): Hooks used outside their provider boundary
3. **Invalid element types** (39 events): Objects or undefined passed as React children/components

## Real Examples

### [JAVASCRIPT-22SP]: InternalError: too much recursion (unresolved)

**Sentry**: https://sentry.io/issues/3573504746/
**Events**: 2,332 | **Users**: 95

**Root cause:** React's rendering loop enters infinite recursion on the `/issues/` route. A component's render function triggers a state update that triggers another render synchronously, causing stack overflow. This is typically caused by a `useEffect` that sets state without proper dependency arrays or conditions.

**Fix pattern:** Add dependency arrays and conditional guards to effects.

```typescript
// Before (infinite loop)
useEffect(() => {
  setValue(computeValue(data));
});

// After (conditional, with deps)
useEffect(() => {
  const newValue = computeValue(data);
  if (newValue !== value) {
    setValue(newValue);
  }
}, [data]);
```

### [JAVASCRIPT-34JC]: useOrganization called but organization is not set (unresolved, 16 variants merged)

**Sentry**: https://sentry.io/issues/7008432988/
**Events**: 55 | **Users**: 36

**Stacktrace:**

```
./app/utils/useOrganization.tsx
  useOrganization
    throws Error("useOrganization called but organization is not set.")
```

**Root cause:** `useOrganization` is called in components that render before the organization context has been loaded. 16 variants from different routes were merged, including `/settings/account/`, `/organizations/:orgId/`, and various feature pages.

**Fix pattern:** Return null instead of throwing, or guard with a loading boundary.

```typescript
// Option 1: Non-throwing hook
function useOrganization(): Organization | null {
  const org = useContext(OrganizationContext);
  return org ?? null;
}

// Option 2: Guard at route level
function RequireOrganization({children}: Props) {
  const org = useOrganization();
  if (!org) return <LoadingIndicator />;
  return children;
}
```

### [JAVASCRIPT-31AY]: Maximum update depth exceeded (resolved, 16 variants merged)

**Sentry**: https://sentry.io/issues/6688802694/
**Events**: 38 | **Users**: 1

**Root cause:** React's infinite re-render detection fires. 16 variants on different pages. The common pattern is an effect that unconditionally sets state on every render.

**Fix pattern:** Ensure all `useEffect` hooks have dependency arrays and state setters are conditional.

**Actual fix:** Resolved (specific fix not available, but the pattern is consistent).

## Detection Checklist

- [ ] Do all `useEffect` and `useLayoutEffect` calls have dependency arrays?
- [ ] Are state setters inside effects conditional (checking if value actually changed)?
- [ ] Is `useOrganization()` called only within routes that have the organization provider?
- [ ] Are `useContext()` calls inside their respective providers?
- [ ] Do dynamic imports and lazy components handle undefined module exports?
- [ ] Are objects being passed as React children? (Should be strings or elements)
- [ ] Is state being set during the render phase (outside effects)?
