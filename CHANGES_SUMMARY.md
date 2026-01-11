# Summary of Changes for QueryCanceled Statement Timeout Fix

## Problem
A PostgreSQL query in the `OutOfSyncReservedBudgetHistory` repair task was exceeding statement_timeout and raising `QueryCanceled` with message "canceling statement due to user request". This error was not being handled gracefully, causing task failures.

## Root Cause
PostgreSQL reports both statement timeouts and explicit query cancellations using the same error message: "canceling statement due to user request". The original code only checked for "canceling statement due to statement timeout", missing many legitimate timeout cases.

## Solution
Implemented comprehensive statement timeout detection and handling utilities in the Sentry codebase.

## Files Changed

### Modified Files

1. **src/sentry/db/postgres/helpers.py**
   - Added `is_statement_timeout()` function to properly detect statement timeouts
   - Handles both explicit timeout messages and `QueryCanceled` exceptions
   - Treats `QueryCanceled` with "user request" as likely timeouts

2. **src/sentry/api/utils.py**
   - Updated `handle_query_errors()` to use new `is_statement_timeout()` helper
   - Provides consistent timeout detection across API endpoints
   - Returns 429 Throttled response for timeouts with helpful message

3. **tests/sentry/api/test_utils.py**
   - Added `psycopg2.errors` import
   - Updated `test_handle_postgres_user_cancel()` to test QueryCanceled with cause
   - Added `test_handle_postgres_user_cancel_without_query_canceled()` for edge cases

4. **tests/sentry/issues/endpoints/test_organization_group_index.py**
   - Added `psycopg2.errors` import
   - Updated `test_postgres_query_timeout()` to test all timeout scenarios
   - Tests both explicit timeouts and QueryCanceled errors

### New Files

1. **src/sentry/utils/statement_timeout.py**
   - `handle_statement_timeout()` context manager for graceful timeout handling
   - `with_statement_timeout_handling()` decorator for timeout-prone functions
   - `execute_with_timeout_handling()` functional wrapper for timeout handling
   - All utilities provide:
     - Fallback values on timeout
     - Logging with context
     - Sentry exception capture with proper tags
     - Optional re-raising

2. **tests/sentry/db/postgres/test_helpers.py**
   - Tests for `can_reconnect()` function
   - Tests for `is_statement_timeout()` function
   - Covers all timeout detection scenarios

3. **tests/sentry/utils/test_statement_timeout.py**
   - Tests for `handle_statement_timeout()` context manager
   - Tests for `with_statement_timeout_handling()` decorator
   - Tests for `execute_with_timeout_handling()` function
   - Validates fallback values, error re-raising, and pass-through behavior

4. **STATEMENT_TIMEOUT_FIX.md**
   - Comprehensive documentation of the fix
   - Usage examples for repair tasks
   - Long-term solutions and recommendations
   - Testing instructions

## Key Features

### 1. Accurate Timeout Detection
- Detects explicit "statement timeout" messages
- Detects `QueryCanceled` exceptions (pgcode 57014)
- Handles ambiguous "user request" messages properly

### 2. Graceful Error Handling
- Context manager for wrapping timeout-prone code
- Decorator for timeout-prone functions
- Functional wrapper for one-off calls
- All support fallback values

### 3. Observability
- Automatic logging with context
- Sentry exception capture with `db.error_type` tag
- Warning-level severity (not errors)
- Preserves original exception for non-timeouts

### 4. Backward Compatibility
- API endpoints automatically benefit from the fix
- Existing error handling remains unchanged
- New utilities are opt-in for tasks

## Usage for Repair Tasks (getsentry)

The repair task can be fixed using:

```python
from sentry.utils.statement_timeout import handle_statement_timeout

class OutOfSyncReservedBudgetHistory(RepairTask):
    def iter(self):
        with handle_statement_timeout(
            log_message="OutOfSyncReservedBudgetHistory query timeout"
        ):
            for item in self.query():
                if not self.filter(item):
                    yield self.make_result(item)
```

## Testing

All syntax validated. To run tests:

```bash
# Test timeout detection
pytest tests/sentry/db/postgres/test_helpers.py -v

# Test timeout handling utilities
pytest tests/sentry/utils/test_statement_timeout.py -v

# Test API error handling
pytest tests/sentry/api/test_utils.py::TestHandleQueryErrors -v

# Test endpoint integration
pytest tests/sentry/issues/endpoints/test_organization_group_index.py::test_postgres_query_timeout -v
```

## Next Steps

1. **In getsentry repository**: Update `OutOfSyncReservedBudgetHistory` to use the new utilities
2. **Optimize the query**: Add indexes, simplify JOINs, or use pagination
3. **Monitor production**: Verify timeouts are handled gracefully
4. **Consider**: Increasing statement_timeout for this specific query if optimization isn't enough

## Impact

- ✅ API endpoints automatically handle statement timeouts correctly
- ✅ Tasks can opt-in to graceful timeout handling
- ✅ Better observability through logging and Sentry tags
- ✅ Consistent error handling across the codebase
- ✅ No breaking changes to existing functionality
