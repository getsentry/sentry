# Quick Reference: Statement Timeout Handling

## What Was Fixed

PostgreSQL `QueryCanceled` errors with message "canceling statement due to user request" are now properly detected as statement timeouts and handled gracefully.

## For API Developers

**No action needed!** The fix is automatic:
- Statement timeouts now return HTTP 429 (Too Many Requests) instead of 500
- Users get helpful message: "Query timeout. Please try with a smaller date range or fewer conditions."

## For Task Developers

Use the new utilities to handle timeouts gracefully:

### Option 1: Context Manager (Recommended)

```python
from sentry.utils.statement_timeout import handle_statement_timeout

def my_task():
    with handle_statement_timeout(log_message="Task query timed out"):
        results = MyModel.objects.raw(slow_query)
        for item in results:
            process(item)
    # Continues execution if timeout occurs
```

### Option 2: Decorator

```python
from sentry.utils.statement_timeout import with_statement_timeout_handling

@with_statement_timeout_handling(fallback_value=[], log_message="Query timeout")
def get_items():
    return list(MyModel.objects.raw(slow_query))
```

### Option 3: Functional Wrapper

```python
from sentry.utils.statement_timeout import execute_with_timeout_handling

results = execute_with_timeout_handling(
    list,
    MyModel.objects.raw(slow_query),
    fallback_value=[],
    log_message="Query timeout"
)
```

## Available Options

All utilities support:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `fallback_value` | Any | `None` | Value to return on timeout |
| `log_message` | str | Auto-generated | Custom log message |
| `capture_exception` | bool | `True` | Send to Sentry |
| `reraise` | bool | `False` | Re-raise after handling (context manager only) |

## What Gets Logged

On timeout, automatically logs:
- ✓ Warning-level message
- ✓ Exception traceback
- ✓ Sentry event with `db.error_type: statement_timeout` tag
- ✓ Custom context if provided

## Testing Your Code

```python
from django.db.utils import OperationalError
import psycopg2.errors

def test_my_task_handles_timeout():
    # Simulate timeout
    exc = OperationalError("canceling statement due to user request")
    exc.__cause__ = psycopg2.errors.QueryCanceled()
    
    with patch('MyModel.objects.raw', side_effect=exc):
        result = my_task()
        assert result is not None  # Should return fallback, not crash
```

## Detecting Timeouts Manually

```python
from sentry.db.postgres.helpers import is_statement_timeout

try:
    run_query()
except OperationalError as e:
    if is_statement_timeout(e):
        # Handle timeout
        pass
    else:
        # Handle other errors
        raise
```

## Best Practices

1. **Always provide a fallback value** if your function returns something
2. **Use descriptive log messages** to help debugging
3. **Consider query optimization** as the long-term fix
4. **Add pagination** for large result sets
5. **Monitor timeouts** in production to identify problem queries

## Files to Import From

```python
# Timeout detection
from sentry.db.postgres.helpers import is_statement_timeout

# Timeout handling
from sentry.utils.statement_timeout import (
    handle_statement_timeout,
    with_statement_timeout_handling,
    execute_with_timeout_handling,
)
```

## Examples from Codebase

### API Error Handling (Automatic)

```python
# src/sentry/api/utils.py
with handle_query_errors():
    results = snuba_query(...)
    # Timeouts automatically become 429 responses
```

### Repair Task Example

```python
from sentry.utils.statement_timeout import handle_statement_timeout

class OutOfSyncReservedBudgetHistory(RepairTask):
    def iter(self):
        with handle_statement_timeout(
            log_message="Statement timeout in repair query"
        ):
            for item in self.query():
                yield self.make_result(item)
```

## Need Help?

- See `STATEMENT_TIMEOUT_FIX.md` for detailed explanation
- See `CHANGES_SUMMARY.md` for complete list of changes
- See test files for more usage examples
