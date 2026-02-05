# Form Validation Improvements

## Overview

This document tracks progress on improving form validation behavior in detector/monitor creation flows, specifically addressing [Linear NEW-736](https://linear.app/new/issue/NEW-736).

## Problem Statement

Validation errors were not being surfaced properly to users during form completion:

1. Errors on sibling fields weren't shown when user started filling out the form
2. Validation errors flickered on every keystroke when using `validateForm()` on field change

## Solution Implemented

A two-pronged validation approach that balances immediate feedback with avoiding flicker:

### 1. First Field Change Validation

- On the **first meaningful field change**, run `validateForm()` once
- This surfaces validation errors on all sibling fields immediately when the user starts entering data
- Tracked via `hasValidatedOnce` ref to ensure it only runs once

### 2. Blur-Based Validation

- Validate the entire form when any field loses focus (blur event)
- Uses event bubbling via a wrapper `<div onBlur={handleFormBlur}>`
- Catches any new errors without causing flicker during typing

### Key Code Changes

**Files Modified:**

- `static/app/views/detectors/components/forms/newDetectorLayout.tsx`
- `static/app/views/detectors/components/forms/editDetectorLayout.tsx`

**Pattern:**

```tsx
// Track whether we've done an initial full validation
const hasValidatedOnce = useRef(false);

// Validate entire form when any field loses focus (via event bubbling)
const handleFormBlur = useCallback(() => {
  if (!isInitialized.current) {
    return;
  }
  formModel.validateForm();
}, [formModel]);

// On first meaningful field change, validate entire form to surface sibling errors
const handleFieldChange = useCallback(() => {
  if (!isInitialized.current || hasValidatedOnce.current) {
    return;
  }
  hasValidatedOnce.current = true;
  formModel.validateForm();
}, [formModel]);

// Wrapper div captures blur events via bubbling
return (
  <div onBlur={handleFormBlur}>
    <EditLayout formProps={{...formProps, onFieldChange: handleFieldChange}}>
      ...
    </EditLayout>
  </div>
);
```

## Next Steps

### 1. Legacy Uptime Monitor Form

- **Location:** `/issues/alerts/new/uptime/`
- **Task:** Apply the same validation pattern (first-change + blur validation)
- **Files to examine:**
  - `static/app/views/alerts/rules/uptime/` directory

### 2. New Uptime Monitor Form

- **Location:** `/monitors/new/settings/?detectorType=uptime_domain_failure`
- **Status:** ✅ Already updated via `newDetectorLayout.tsx`

### 3. Legacy Cron Monitor Form

- **Location:** `/crons/create/` or similar
- **Task:** Apply the same validation pattern
- **Files to examine:**
  - `static/app/views/monitors/` directory (legacy crons)

### 4. New Cron Monitor Form

- **Location:** `/monitors/new/settings/?detectorType=monitor_check_in_failure`
- **Status:** ✅ Already updated via `newDetectorLayout.tsx`

### 5. Edit Forms

- Ensure edit flows for both uptime and cron monitors follow the same pattern
- **Status:** ✅ `editDetectorLayout.tsx` already updated

### 6. Add Tests

- Add tests for the new validation behavior in detector layout components
- Test cases to cover:
  - Validation errors appear on sibling fields after first field change
  - Validation runs on field blur
  - No validation during initialization
  - No flickering (validation doesn't re-run on every keystroke after first change)
- **Files to add/update:**
  - `static/app/views/detectors/components/forms/newDetectorLayout.spec.tsx`
  - `static/app/views/detectors/components/forms/editDetectorLayout.spec.tsx`

## Related Linear Tickets

- **NEW-736:** Improve how we're displaying validation errors in the Uptime monitor creation flow
- **NEW-737:** Implement FE validation for uptime monitor assertion count limit (separate ticket)

## Testing

All existing tests pass:

```bash
CI=true pnpm test static/app/views/detectors/new-setting.spec.tsx
# 15 passed
```

## Notes

- The `FormModel` in `static/app/components/forms/model.tsx` was **not** modified - the fix is entirely at the component level
- Individual fields still validate themselves via `setValue -> validateField` on change
- The wrapper `<div onBlur>` approach avoids needing to modify the core Form component
