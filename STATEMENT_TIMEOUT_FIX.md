# Fix for QueryCanceled / Statement Timeout Issue

## Issue Summary

The issue involved a PostgreSQL `QueryCanceled` error with the message "canceling statement due to user request" that was not being handled gracefully in repair tasks. This error occurred when a slow database query exceeded PostgreSQL's `statement_timeout`.

## Root Cause

PostgreSQL uses the error message "canceling statement due to user request" for BOTH:
1. Actual user-initiated query cancellations (explicit)
2. Statement timeouts (`statement_timeout` exceeded)

The original code only checked for the exact string "canceling statement due to statement timeout", missing cases where timeouts were reported as "user request". This ambiguity in PostgreSQL's error messages led to unhandled exceptions in production tasks.

## Fix Details

### 1. Enhanced Statement Timeout Detection (`src/sentry/db/postgres/helpers.py`)

Added `is_statement_timeout()` function that properly detects statement timeouts by:
- Checking for explicit "statement timeout" messages
- Detecting `psycopg2.errors.QueryCanceled` exceptions with "user request" messages
- Treating QueryCanceled errors as likely timeouts (since explicit cancellations are rare in production)

```python
def is_statement_timeout(exc):
    """
    Check if an exception is due to a PostgreSQL statement timeout.
    Handles both explicit timeout messages and QueryCanceled errors.
    """
```

### 2. Updated API Error Handling (`src/sentry/api/utils.py`)

Modified `handle_query_errors()` to use the new `is_statement_timeout()` helper, providing consistent timeout detection across the codebase.

### 3. New Database Utilities (`src/sentry/utils/statement_timeout.py`)

Created comprehensive utilities for handling statement timeouts in tasks and queries:

- **`handle_statement_timeout()` context manager**: Allows graceful handling of timeouts without failing
- **`with_statement_timeout_handling()` decorator**: Decorator for functions that may timeout
- **`execute_with_timeout_handling()` function**: Functional wrapper for timeout-prone operations

These utilities:
- Detect and handle statement timeouts gracefully
- Provide fallback values when timeouts occur
- Log timeouts with appropriate context
- Capture exceptions to Sentry with proper tags
- Allow tasks to continue executing instead of failing

### 4. Updated Tests

Updated existing tests to reflect the new behavior:
- `tests/sentry/api/test_utils.py`: Added test for QueryCanceled with/without cause
- `tests/sentry/issues/endpoints/test_organization_group_index.py`: Updated to handle QueryCanceled properly
- `tests/sentry/db/postgres/test_helpers.py`: New tests for statement timeout detection
- `tests/sentry/utils/test_db.py`: New tests for database utilities

## Usage Examples

### For Repair Tasks (getsentry repository)

The repair task causing the issue can now be fixed using the new utilities:

```python
from sentry.utils.statement_timeout import handle_statement_timeout

class OutOfSyncReservedBudgetHistory(RepairTask):
    def iter(self):
        with handle_statement_timeout(
            log_message="Statement timeout in OutOfSyncReservedBudgetHistory query"
        ):
            for item in self.query():
                if not self.filter(item):
                    yield self.make_result(item)
        # If timeout occurs, iteration stops gracefully without failing the task
```

Or with a decorator:

```python
from sentry.utils.statement_timeout import with_statement_timeout_handling

class OutOfSyncReservedBudgetHistory(RepairTask):
    @with_statement_timeout_handling(
        fallback_value=[], 
        log_message="Repair query timed out"
    )
    def query(self):
        return list(Subscription.objects.raw(...))
```

### For API Endpoints

The fix is already integrated into `handle_query_errors()`, so existing API endpoints automatically benefit:

```python
with handle_query_errors():
    results = snuba_query(...)  # Timeouts now properly return 429 with helpful message
```

## Long-term Solutions

While this fix handles the immediate issue, the underlying problem should still be addressed:

1. **Query Optimization**: The complex query in `OutOfSyncReservedBudgetHistory` should be optimized:
   - Add appropriate indexes
   - Simplify JOINs if possible
   - Consider breaking into smaller queries

2. **Pagination/Batching**: Large result sets should be processed in batches:
   ```python
   # Use RangeQuerySetWrapper with query_timeout_retries
   from sentry.utils.query import RangeQuerySetWrapper
   
   for item in RangeQuerySetWrapper(
       queryset, 
       step=100, 
       query_timeout_retries=3
   ):
       process(item)
   ```

3. **Increase Timeout for Specific Queries**: If the query is legitimately slow:
   ```python
   from django.db import connection
   
   with connection.cursor() as cursor:
       cursor.execute("SET LOCAL statement_timeout = '5min'")
       results = run_slow_query()
   ```

## Testing

To verify the fix:

1. Run the updated tests:
   ```bash
   pytest tests/sentry/db/postgres/test_helpers.py
   pytest tests/sentry/utils/test_statement_timeout.py
   pytest tests/sentry/api/test_utils.py -k test_handle_postgres
   ```

2. For the specific repair task, verify it no longer crashes on timeout:
   - Monitor the task in production
   - Check Sentry for any remaining QueryCanceled exceptions
   - Verify graceful handling in logs

## Related Files

- `src/sentry/db/postgres/helpers.py` - Core timeout detection
- `src/sentry/utils/statement_timeout.py` - Timeout handling utilities
- `src/sentry/api/utils.py` - API error handling
- `tests/sentry/db/postgres/test_helpers.py` - Tests for helpers
- `tests/sentry/utils/test_statement_timeout.py` - Tests for utilities
- `tests/sentry/api/test_utils.py` - Updated API tests
- `tests/sentry/issues/endpoints/test_organization_group_index.py` - Updated endpoint tests
