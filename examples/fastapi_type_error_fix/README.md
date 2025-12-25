# FastAPI TypeError Fix Example

This example demonstrates how to fix a real production error reported to Sentry:

**Error:** `TypeError: OfferComparisonService.compare_offers() got an unexpected keyword argument 'priority_weights'`

**Location:** `/api/v1/offer-comparison/compare`

## Quick Start

Run the verification to see the fix in action:

```bash
cd /workspace/examples/fastapi_type_error_fix
python3 verify_fix.py
```

Or reproduce the exact Sentry error:

```bash
python3 reproduce_sentry_error.py
```

## The Problem

The FastAPI route handler was passing three parameters to the service:

```python
result = await service.compare_offers(
    offer_ids=request.offer_ids,
    priority_weights=request.priority_weights,  # ← Service doesn't accept this!
    target_location=request.target_location
)
```

But the service method only accepted two:

```python
async def compare_offers(self, offer_ids, target_location=None):
    # Missing priority_weights parameter!
```

This caused a `TypeError` whenever the endpoint was called.

## The Solution

Add the missing `priority_weights` parameter to the service method signature:

```python
async def compare_offers(
    self,
    offer_ids: list[str],
    priority_weights: Optional[dict[str, float]] = None,  # ✅ Added
    target_location: Optional[str] = None
) -> dict:
```

## Files

### Core Files
- **`service_broken.py`** - Original code with the bug
- **`service_fixed.py`** - Fixed code with the parameter added
- **`routes.py`** - FastAPI route that calls the service
- **`models.py`** - Pydantic request/response models

### Documentation
- **`FIX_SUMMARY.md`** - Detailed explanation of the fix
- **`CODE_COMPARISON.md`** - Side-by-side comparison of broken vs fixed code

### Tests & Verification
- **`verify_fix.py`** - Comprehensive verification script (no external deps)
- **`reproduce_sentry_error.py`** - Reproduces the exact Sentry error
- **`test_fix.py`** - Full pytest test suite (requires FastAPI/pytest)

## Understanding the Root Cause

This error occurs when:
1. A developer adds a new optional field to a Pydantic request model
2. The route handler passes all request fields to a service method
3. The service method signature wasn't updated to accept the new field
4. Python raises `TypeError` when it receives an unexpected keyword argument

## How to Prevent This

1. **Update synchronously**: When adding fields to request models, immediately update service methods
2. **Code review**: Check that all parameters passed to methods exist in their signatures
3. **Type checking**: Use mypy or similar tools to catch signature mismatches
4. **Testing**: Write tests that exercise all optional parameters
5. **Integration tests**: Test the full request → route → service flow

## Expected Output

Running `verify_fix.py` should show:

```
✅ All verifications passed! The fix is working correctly.
```

This confirms:
- ✓ Broken service is missing the parameter
- ✓ Fixed service has all required parameters
- ✓ Broken service fails with the expected TypeError
- ✓ Fixed service executes successfully

## Learn More

- See `FIX_SUMMARY.md` for detailed analysis
- See `CODE_COMPARISON.md` for before/after code comparison
- Run `reproduce_sentry_error.py` to see the exact error from Sentry
