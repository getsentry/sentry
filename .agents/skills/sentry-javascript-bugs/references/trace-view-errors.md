# Trace View Error Patterns

## Contents

- Overview
- Real examples
- Detection checklist

## Overview

Trace view errors account for 12 issues and 328,482 events -- the highest-impact cluster by far. The trace tree renderer and span detail views make structural assumptions about trace data that break when traces contain cycles, reference inaccessible projects, or lack required fields like trace IDs.

Key sub-patterns:

1. **Cycle detection in trace trees** (231K events): Parent-child span relationships form cycles
2. **Project not found in trace details** (94K events): Span references a project the user cannot access
3. **Missing trace slug** (347 events): Trace context is absent from events, breaking link generation

## Real Examples

### [JAVASCRIPT-36K9]: Cycle detected in trace tree structure (unresolved)

**Sentry**: https://sentry.io/issues/7219873856/
**Status**: unresolved | **Events**: 231,413 | **Users**: 79,607

No in-app exception frames (info-level captureMessage on `/explore/traces/trace/:traceSlug/`).

**Root cause:** The trace tree builder detects a cycle in span parent-child relationships (A -> B -> A). This fires for every user who views an affected trace, generating enormous volume.

**Fix pattern:** Handle cycles gracefully by detaching cyclic spans as orphan roots. Rate-limit the diagnostic message per trace ID.

### [JAVASCRIPT-2ZX1]: Project not found in useTraceItemDetails (resolved, 3 variants merged)

**Stacktrace:**

```
./app/views/performance/newTraceDetails/traceDrawer/details/span/index.tsx
  EAPSpanNodeDetails (line 349)
    } = useTraceItemDetails({
      projectId: node.value.project_id.toString(),
      ...

./app/views/explore/hooks/useTraceItemDetails.tsx
  useTraceItemDetails (line 103)
    if ((props.enabled ?? true) && !project && !fetching) {
      captureException(
        new Error(`Project "${props.projectId}" not found in useTraceItemDetails`)
      );
    }
```

**Root cause:** Span data references a project ID that is not in the user's accessible projects. The hook fires `captureException` on every render cycle without deduplication.

**Fix pattern:** Deduplicate the error capture. Return a graceful "project not accessible" state.

```typescript
const capturedRef = useRef(new Set<string>());
if (!project && !fetching && !capturedRef.current.has(props.projectId)) {
  capturedRef.current.add(props.projectId);
  captureException(new Error(`Project "${props.projectId}" not found`));
}
```

### [JAVASCRIPT-3370]: Trace slug is missing (unresolved, 4 variants merged)

**Stacktrace:**

```
./app/components/events/interfaces/performance/spanEvidenceKeyValueList.tsx
  makeTransactionNameRow (line 610)
    const traceSlug = event.contexts?.trace?.trace_id ?? '';
    const eventDetailsLocation = generateLinkToEventInTraceView({traceSlug, ...});

./app/utils/discover/urls.tsx
  generateLinkToEventInTraceView (line 82)
    if (!traceSlug) {
      Sentry.captureException(new Error('Trace slug is missing'));
    }
```

**Root cause:** Events without trace context (no `contexts.trace.trace_id`) produce an empty traceSlug. The link generator detects the problem but generates a broken link anyway.

**Fix pattern:** Check traceSlug before calling the link generator. Show a fallback when trace context is missing.

```typescript
const traceSlug = event.contexts?.trace?.trace_id;
if (!traceSlug) {
  return makeRow(t('Transaction'), event.title);
}
```

## Detection Checklist

- [ ] Does trace tree building handle cycles (parent-child loops)?
- [ ] Are project IDs from span data validated against accessible projects?
- [ ] Is `traceSlug` checked for emptiness before generating trace links?
- [ ] Do `captureException` calls in hooks use deduplication (refs, sets)?
- [ ] Are error captures in render paths guarded against firing every render cycle?
- [ ] Do trace detail components handle missing/inaccessible spans gracefully?
