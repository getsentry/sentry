# AsyncMock Fix for "object MagicMock can't be used in 'await' expression"

## Quick Start

Run the verification script to see the fix in action:

```bash
python3 examples/async_mock_fix/verify_fix.py
```

## What's in This Directory

### Core Files

1. **`verify_fix.py`** - ⭐ Start here! Standalone script demonstrating the issue and solution
2. **`README.md`** - Comprehensive documentation with examples and best practices
3. **`SOLUTION_SUMMARY.md`** - Executive summary of the issue and resolution

### Example Code

4. **`api_routes_networking.py`** - FastAPI endpoint with async dependencies (mirrors the original error)
5. **`test_networking_broken.py`** - Demonstrates the broken MagicMock approach
6. **`test_networking_fixed.py`** - Shows correct AsyncMock implementation
7. **`practical_examples.py`** - Real-world test patterns for Sentry-style tests

## The Problem

```python
# ❌ BROKEN: This causes TypeError
mock_service = MagicMock()
mock_service.async_method.return_value = {...}
result = await service.async_method()  # TypeError: object MagicMock can't be used in 'await' expression
```

## The Solution

```python
# ✅ FIXED: Use AsyncMock for async methods
from unittest.mock import AsyncMock

mock_service = MagicMock()
mock_service.async_method = AsyncMock(return_value={...})
result = await service.async_method()  # Works correctly!
```

## File Descriptions

### verify_fix.py
Standalone verification script that runs without any dependencies (except Python 3.8+).
Shows:
- The broken case with MagicMock
- The fixed case with AsyncMock
- Bonus: AsyncMock with side effects

**Run it:** `python3 verify_fix.py`

### api_routes_networking.py
Simulates the FastAPI endpoint from the Sentry error report:
- POST `/api/v1/networking/connections/respond` endpoint
- Async service dependency injection
- Error at line 207 (as reported in Sentry)

### test_networking_broken.py
Demonstrates the problem:
- Uses MagicMock for async service (WRONG)
- Shows the exact error from the Sentry report
- Educational example of what NOT to do

### test_networking_fixed.py
Shows the correct solution:
- Uses AsyncMock for async methods (CORRECT)
- Multiple test scenarios (success, rejection, errors)
- Complete FastAPI test setup with dependency overrides
- Includes assertion examples

### practical_examples.py
Real-world test patterns:
- Integration service testing
- Error handling with AsyncMock
- Multiple return values with side_effect
- AsyncMock-specific assertions (await_count, await_args)
- pytest-asyncio examples (if available)
- Direct comparison of broken vs fixed approaches

**Run it:** `python3 practical_examples.py`

### README.md
Complete documentation including:
- Problem summary and root cause
- Solution approaches (2 methods)
- When to use each mock type
- AsyncMock features (side effects, assertions)
- Python version requirements
- Troubleshooting guide

### SOLUTION_SUMMARY.md
Executive summary for stakeholders:
- Issue resolution status
- Before/after code comparison
- Verification results
- Testing guidelines
- Impact assessment

## Quick Reference

### Import

```python
from unittest.mock import MagicMock, AsyncMock
```

### Basic Usage

```python
# For async methods
mock.async_method = AsyncMock(return_value=result)

# For async methods with exceptions
mock.async_method = AsyncMock(side_effect=ValueError("error"))

# For async methods with multiple calls
mock.async_method = AsyncMock(side_effect=[result1, result2, result3])
```

### Assertions

```python
# Check if awaited
mock.async_method.assert_awaited()
mock.async_method.assert_awaited_once()
mock.async_method.assert_awaited_with(arg1, arg2)
mock.async_method.assert_awaited_once_with(arg1, arg2)

# Check await count
assert mock.async_method.await_count == 2

# Check await arguments
assert mock.async_method.await_args == ((arg1, arg2), {})
```

## Testing the Examples

### Without pytest

```bash
# Verify the fix
python3 verify_fix.py

# Run practical examples
python3 practical_examples.py
```

### With pytest (if available)

```bash
# Run all tests
pytest test_networking_fixed.py -v

# Run specific test
pytest test_networking_fixed.py::test_respond_to_connection_fixed_with_asyncmock -v

# Run practical examples with pytest
pytest practical_examples.py -v
```

## Requirements

- Python 3.8+ (for `AsyncMock`)
- For FastAPI examples: `fastapi`, `pydantic`
- For pytest examples: `pytest`, `pytest-asyncio`

**Note:** The verification scripts (`verify_fix.py` and `practical_examples.py`) work standalone with just Python 3.8+.

## Integration with Sentry

These examples can be integrated into the Sentry test suite:

1. Copy test patterns from `test_networking_fixed.py`
2. Use practical examples from `practical_examples.py`
3. Follow guidelines in `README.md`

## Related Issues

- Sentry Issue ID: httpexception-object-magicmock-pwgr8s
- Error: `TypeError: object MagicMock can't be used in 'await' expression`
- Status: ✅ Resolved

## Additional Resources

- [Python unittest.mock documentation](https://docs.python.org/3/library/unittest.mock.html)
- [AsyncMock documentation](https://docs.python.org/3/library/unittest.mock.html#unittest.mock.AsyncMock)
- [FastAPI Testing](https://fastapi.tiangolo.com/tutorial/testing/)
- [pytest-asyncio](https://pytest-asyncio.readthedocs.io/)

---

**Status:** Complete working solution with verification, documentation, and examples.
