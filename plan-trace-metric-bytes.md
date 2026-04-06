# Plan: Add Trace Metric Bytes Formatting Tests & Fix Remaining Gaps

## Context

Trace metric bytes is a volume-based (byte) category like log bytes and attachments. The core formatting in `organizationStats/utils.tsx` (`formatUsageWithUnits`, `getFormatUsageOptions`) and `isByteCategory()` already handle `TRACE_METRIC_BYTE`. However, there are two remaining gaps: missing test coverage and a hardcoded byte-category check that will break every time a new byte category is added.

## Changes

### 1. Replace hardcoded byte-category check in `planMigrationRow.tsx` with `unitType` lookup

**File:** `static/gsApp/views/subscriptionPage/planMigrationActive/planMigrationRow.tsx:62-67`

The current code:

```typescript
if (
  category === DataCategoryExact.ATTACHMENT ||
  category === DataCategoryExact.LOG_BYTE
) {
  return reservedWithUnits;
}
```

Replace with a check against the canonical source of truth:

```typescript
if (DATA_CATEGORY_INFO[category].formatting.unitType === 'bytes') {
  return reservedWithUnits;
}
```

This covers `ATTACHMENT`, `LOG_BYTE`, and `TRACE_METRIC_BYTE` today, and automatically covers any future byte category without code changes. The `DataCategoryExact` import stays because it is still used for `PROFILE_DURATION` and `TRANSACTION` checks on lines 69 and 74.

### 2. Add parameterized byte-formatting test to `organizationStats/utils.spec.tsx`

**File:** `static/app/views/organizationStats/utils.spec.tsx`

Instead of duplicating the Attachments test block for trace metric bytes, parameterize over all byte categories. Replace the existing single-category `'returns correct strings for Attachments'` block (lines 82–151) with an `it.each` that loops over `attachment`, `log_byte`, and `trace_metric_byte`. All three share the same code path in `formatUsageWithUnits`, so expected values are identical. This makes it self-documenting that byte categories are a class with shared behavior, and cheaper to extend next time.

### 3. Add a unit test for `formatCategoryRowString`

**File:** new test or colocated in an existing test for `planMigrationRow.tsx`

The actual bug lives in `formatCategoryRowString`, so test it directly. Cover at least:

- A byte category (e.g. `TRACE_METRIC_BYTE`) returns the raw `reservedWithUnits` string (no appended display name).
- `PROFILE_DURATION` returns `"<value> hours"`.
- A count category (e.g. `ERROR`) returns `"<value> <displayName>"`.

This validates the fix from change 1 and catches regressions if someone re-introduces a hardcoded list.

## Verification

```bash
CI=true pnpm test static/app/views/organizationStats/utils.spec.tsx
CI=true pnpm test static/gsApp/views/subscriptionPage/planMigrationActive/planMigrationRow
```
