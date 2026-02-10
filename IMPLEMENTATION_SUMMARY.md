# Implementation Summary: Node.js Error Cause Prioritization

## Issue Reference

Linear Issue: **ID-1350** - "Prioritize error cause as primary exception for Node.js chained errors"

## Problem Statement

When Node.js errors are thrown with a cause (e.g., `throw new CustomError(message, { cause: originalError })`), Sentry always surfaced the outermost wrapper error in issue titles, alerts, and crash locations. The inner cause, which is often the most actionable part of the failure, was buried in the stack trace.

## Solution Implemented

### 1. Added `nodejs_error_with_cause()` Function

**Location:** `src/sentry/grouping/strategies/newstyle.py` (lines 955-978)

This function extends the existing `main_exception_id` override mechanism to recognize generic Node.js/JavaScript cause chains. It:

- Detects exceptions with `mechanism.source = "cause"` (the standard way SDKs mark error causes)
- Returns the cause as the primary exception for issue titles and grouping
- Applies to all JavaScript/Node.js platforms (browser and server)
- Handles multiple chained causes by selecting the innermost one

### 2. Registered in Exception Handler Priority List

**Location:** `src/sentry/grouping/strategies/newstyle.py` (lines 1050-1055)

Added to `MAIN_EXCEPTION_ID_FUNCS` in priority order:

1. `react_error_with_cause` - React-specific handling (more specific, checked first)
2. **`nodejs_error_with_cause`** - Generic JavaScript/Node.js handling (NEW)
3. `java_rxjava_framework_exceptions` - RxJava handling
4. `kotlin_coroutine_framework_exceptions` - Kotlin Coroutines handling

### 3. Comprehensive Test Coverage

**Location:** `tests/sentry/event_manager/test_event_manager.py` (lines 483-697)

Added 5 test cases covering:

- ✅ Simple Node.js error with cause prioritization
- ✅ Browser JavaScript error with cause
- ✅ Multiple chained causes (selects innermost)
- ✅ Errors without causes use default behavior
- ✅ React-specific handling still takes precedence

## Technical Details

### How It Works

1. When processing chained exceptions, Sentry calls `_maybe_override_main_exception_id()`
2. This function tries each handler in `MAIN_EXCEPTION_ID_FUNCS` until one returns a match
3. `nodejs_error_with_cause()` checks if any exception has `mechanism.source == "cause"`
4. If found, returns that exception's ID to use for the issue title instead of the default (last exception)

### Exception Ordering in Sentry

- Exceptions are ordered from **innermost (index 0)** to **outermost (index -1)**
- Default behavior: use the last exception (index -1) for the title
- With this change: use the exception marked with `source="cause"` (typically index 0)

### Mechanism Source Field

From the Sentry event schema, `mechanism.source` describes the source of the exception in chained errors:

- **JavaScript/Node.js:** `"cause"`, `"errors[0]"`, `"errors[1]"`
- **.NET:** `"InnerException"`, `"InnerExceptions[0]"`
- **Python:** `"__context__"`, `"__cause__"`, `"exceptions[0]"`

## Example Use Cases

### Before (Problem)

```javascript
const dbError = new Error('Connection timeout');
const appError = new CustomError('Failed to initialize', {cause: dbError});
throw appError;
```

**Issue Title:** `CustomError: Failed to initialize` ❌ (wrapper, less actionable)

### After (Solution)

**Issue Title:** `Error: Connection timeout` ✅ (root cause, more actionable)

## Files Modified

### Implementation

- `src/sentry/grouping/strategies/newstyle.py`
  - Added `nodejs_error_with_cause()` function (24 lines)
  - Updated `MAIN_EXCEPTION_ID_FUNCS` list (1 line)

### Tests

- `tests/sentry/event_manager/test_event_manager.py`
  - Added 5 comprehensive test cases (215 lines)

## Validation

- ✅ Python syntax validated using `ast.parse()`
- ✅ Code follows existing patterns (React, RxJava, Kotlin handlers)
- ✅ Comprehensive test coverage for all scenarios
- ✅ Committed with descriptive commit messages
- ✅ Pushed to branch `cursor/ID-1350-node-js-error-cause-primary-4894`

## Compatibility

- **Backwards Compatible:** Yes, only affects events with `mechanism.source="cause"`
- **Platform Coverage:** All JavaScript/Node.js platforms (browser, Node.js, Deno, Bun)
- **SDK Requirements:** Requires SDKs that populate `mechanism.source` (most modern Sentry JavaScript SDKs)

## Related Work

This implementation follows the same pattern as existing handlers:

- React 19 error handling (PR/issue reference needed from Git history)
- RxJava exception unwrapping
- Kotlin Coroutines diagnostic exception handling

## Next Steps

1. ✅ Implementation complete
2. ✅ Tests added
3. ✅ Committed and pushed
4. ⏳ CI/CD validation (automated)
5. ⏳ Code review
6. ⏳ Merge to main
7. ⏳ Deploy to production

## Notes

- The React-specific handler remains first in priority to preserve existing behavior for React errors
- Generic Node.js handling applies broadly but can be extended with platform-specific logic if needed
- Multiple chained causes are handled by selecting the first (innermost) exception with `source="cause"`
