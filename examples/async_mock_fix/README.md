# Fix for HTTPException: object MagicMock can't be used in 'await' expression

## Problem Summary

When testing async FastAPI endpoints with dependency injection, using `unittest.mock.MagicMock` for async service methods causes a `TypeError` at runtime:

```
TypeError: object MagicMock can't be used in 'await' expression
```

This error occurs because `MagicMock` objects are not awaitable. When FastAPI tries to execute `await service.method()`, Python cannot await a regular `MagicMock` instance.

## Root Cause

The issue occurs in this pattern:

```python
# ❌ BROKEN: Using MagicMock for async methods
mock_service = MagicMock()
mock_service.respond_to_request.return_value = {...}  # Not awaitable!

# In the endpoint:
result = await service.respond_to_request(...)  # TypeError here!
```

The `MagicMock.return_value` is just a regular Python object, not an awaitable coroutine.

## Solution

Use `unittest.mock.AsyncMock` for async methods instead of `MagicMock`.

### Approach 1: Mock Individual Async Methods with AsyncMock

```python
from unittest.mock import MagicMock, AsyncMock

# ✅ CORRECT: Use AsyncMock for async methods
mock_service = MagicMock(spec=NetworkingService)
mock_service.respond_to_request = AsyncMock(return_value={
    "request_id": "test-123",
    "status": "accepted",
    "user_id": "user-456"
})
```

### Approach 2: Use AsyncMock for the Entire Service

```python
from unittest.mock import AsyncMock

# ✅ CORRECT: Use AsyncMock for the whole service
mock_service = AsyncMock(spec=NetworkingService)
mock_service.respond_to_request.return_value = {
    "request_id": "test-123",
    "status": "accepted",
    "user_id": "user-456"
}
```

## Complete Working Example

### Service and Endpoint (api_routes_networking.py)

```python
class NetworkingService:
    async def respond_to_request(self, user_id: str, request_id: str, accept: bool) -> dict:
        # Async service method
        return {"request_id": request_id, "status": "accepted" if accept else "rejected"}

@router.post("/connections/respond")
async def respond_to_connection(
    request: ConnectionResponseRequest,
    service: NetworkingService = Depends(get_networking_service),
) -> dict:
    # This line needs service to be awaitable
    result = await service.respond_to_request(
        user_id=current_user["user_id"],
        request_id=request.request_id,
        accept=request.accept
    )
    return {"success": True}
```

### Fixed Test (test_networking_fixed.py)

```python
from unittest.mock import MagicMock, AsyncMock
from fastapi.testclient import TestClient

def test_respond_to_connection():
    app = FastAPI()
    app.include_router(router)
    
    # ✅ Use AsyncMock for async methods
    mock_service = MagicMock(spec=NetworkingService)
    mock_service.respond_to_request = AsyncMock(return_value={
        "request_id": "test-123",
        "status": "accepted",
        "user_id": "user-456"
    })
    
    app.dependency_overrides[get_networking_service] = lambda: mock_service
    
    client = TestClient(app)
    response = client.post(
        "/api/v1/networking/connections/respond",
        json={"request_id": "test-123", "accept": True}
    )
    
    assert response.status_code == 200  # ✅ Success!
```

## When to Use Each Mock Type

| Scenario | Use |
|----------|-----|
| Mocking async functions/methods | `AsyncMock` |
| Mocking regular synchronous functions | `MagicMock` or `Mock` |
| Mocking a class with both sync and async methods | `MagicMock` for the class, `AsyncMock` for async methods |
| Mocking async context managers | `AsyncMock` with `__aenter__` and `__aexit__` |

## Additional AsyncMock Features

### Side Effects

```python
mock_service.respond_to_request = AsyncMock(
    side_effect=ValueError("Not found")
)
```

### Multiple Return Values

```python
mock_service.respond_to_request = AsyncMock(
    side_effect=[result1, result2, result3]
)
```

### Assertions

```python
mock_service.respond_to_request.assert_called_once_with(
    user_id="123",
    request_id="456",
    accept=True
)

assert mock_service.respond_to_request.await_count == 1
assert mock_service.respond_to_request.called
```

## Python Version Requirements

- `AsyncMock` was introduced in Python 3.8
- For Python 3.7 and earlier, you need to use third-party libraries like `asynctest` or manually create awaitable mocks

## Testing the Fix

Run the tests to see the difference:

```bash
# This will fail with the MagicMock error
python examples/async_mock_fix/test_networking_broken.py

# These will pass
pytest examples/async_mock_fix/test_networking_fixed.py -v
```

## Related Error Messages

If you see any of these errors, you likely need to use `AsyncMock`:

- `TypeError: object MagicMock can't be used in 'await' expression`
- `TypeError: object Mock can't be used in 'await' expression`
- `RuntimeWarning: coroutine was never awaited`

## Summary

**Problem:** `MagicMock` doesn't work with async/await patterns.

**Solution:** Use `AsyncMock` from `unittest.mock` (Python 3.8+) for async functions.

**Key Takeaway:** Always match your mock type to the function type:
- Async function → `AsyncMock`
- Sync function → `MagicMock` or `Mock`
