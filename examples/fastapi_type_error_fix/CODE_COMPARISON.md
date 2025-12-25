# Code Comparison: The Fix

## The Problem
The route handler in `routes.py` calls the service with three parameters:

```python
# routes.py
result = await service.compare_offers(
    offer_ids=request.offer_ids,
    priority_weights=request.priority_weights,  # ← This parameter is passed
    target_location=request.target_location
)
```

But the service method only accepts two:

```python
# service_broken.py (BEFORE)
async def compare_offers(
    self,
    offer_ids: list[str],
    target_location: Optional[str] = None
    # ❌ priority_weights is missing!
) -> dict:
```

This causes:
```
TypeError: OfferComparisonService.compare_offers() got an unexpected keyword argument 'priority_weights'
```

## The Solution
Add the missing parameter to the service method:

```python
# service_fixed.py (AFTER)
async def compare_offers(
    self,
    offer_ids: list[str],
    priority_weights: Optional[dict[str, float]] = None,  # ✅ Added this line
    target_location: Optional[str] = None
) -> dict:
```

## Full Fixed Service Implementation

```python
# service_fixed.py
from typing import Optional


class OfferComparisonService:
    """Service for comparing job offers."""

    def __init__(self):
        self.offers_db = {}

    async def compare_offers(
        self,
        offer_ids: list[str],
        priority_weights: Optional[dict[str, float]] = None,
        target_location: Optional[str] = None
    ) -> dict:
        """
        Compare multiple offers side-by-side.

        Args:
            offer_ids: List of offer IDs to compare
            priority_weights: Optional weights for prioritizing different offer attributes
            target_location: Optional target location for comparison

        Returns:
            Dictionary containing comparison results
        """
        # Simplified logic for demonstration
        offers = [
            {"id": offer_id, "title": f"Offer {i}"}
            for i, offer_id in enumerate(offer_ids)
        ]

        # Use priority_weights if provided
        if priority_weights:
            # Apply weighting logic here
            pass

        # Use target_location if provided
        if target_location:
            # Filter or adjust based on location
            pass

        return {
            "offers": offers,
            "best_match": offer_ids[0] if offer_ids else None,
            "comparison_matrix": {},
        }
```

## Why This Happens
1. Developer adds new optional field to request model (`priority_weights`)
2. Route handler automatically passes all request fields to service
3. Service method signature wasn't updated to accept the new field
4. Python raises TypeError when it receives an unexpected keyword argument

## How to Prevent
1. **Update in sync**: When adding fields to request models, immediately update service methods
2. **Code review**: Check that all parameters passed to a method are in its signature
3. **Testing**: Write tests that pass all optional parameters
4. **Type checking**: Use mypy or similar tools to catch signature mismatches early
5. **Documentation**: Keep method signatures and API documentation in sync

## Verification
The verification script confirms the fix:

```bash
$ python3 verify_fix.py

Broken Service Parameters:
  ['offer_ids', 'target_location']
  ✗ Missing 'priority_weights' parameter - This will cause TypeError!

Fixed Service Parameters:
  ['offer_ids', 'priority_weights', 'target_location']
  ✓ All required parameters present

Testing broken service execution:
  ✓ Expected TypeError occurred: ...got an unexpected keyword argument 'priority_weights'

Testing service execution:
  ✓ Service executed successfully
  Result: {'offers': [...], 'best_match': '...', 'comparison_matrix': {}}

✅ All verifications passed! The fix is working correctly.
```
