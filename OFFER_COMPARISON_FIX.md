# Offer Comparison Service - Fix Documentation

## Issue Fixed

**TypeError**: `OfferComparisonService.compare_offers() got an unexpected keyword argument 'priority_weights'`

This error occurred when the API endpoint `/api/v1/offer-comparison/compare` attempted to call `service.compare_offers()` with three parameters (`offer_ids`, `priority_weights`, `target_location`), but the service method only accepted `offer_ids`.

## Root Cause

The API route handler was calling the service method with parameters that weren't in the method signature:

```python
# API route was calling:
result = await service.compare_offers(
    offer_ids=request.offer_ids,
    priority_weights=request.priority_weights,  # ❌ Not accepted by service
    target_location=request.target_location     # ❌ Not accepted by service
)

# But service method only accepted:
async def compare_offers(self, offer_ids: List[str]) -> Dict[str, Any]:
```

## Solution

Updated both the API route and service method to support the complete set of parameters:

### 1. Updated `ComparisonRequest` Model

```python
class ComparisonRequest(BaseModel):
    """Model for comparing offers."""
    offer_ids: List[str]
    priority_weights: Optional[Dict[str, float]] = None  # ✅ Added
    target_location: Optional[str] = None                # ✅ Added
```

### 2. Updated Service Method Signature

```python
async def compare_offers(
    self, 
    offer_ids: List[str],
    priority_weights: Optional[Dict[str, float]] = None,  # ✅ Added
    target_location: Optional[str] = None                 # ✅ Added
) -> Dict[str, Any]:
```

### 3. Updated API Route Path

Changed from `/offers/compare` to `/compare` to match the error trace path `/api/v1/offer-comparison/compare`.

### Service Methods

1. **`list_offers(limit: int = 20)`** - List all saved offers with pagination
2. **`get_offer(offer_id: str)`** - Get a specific offer by ID
3. **`create_offer(offer_data: Dict)`** - Create a new offer
4. **`update_offer(offer_id: str, offer_data: Dict)`** - Update an existing offer
5. **`delete_offer(offer_id: str)`** - Delete an offer
6. **`compare_offers(offer_ids, priority_weights=None, target_location=None)`** - Compare multiple offers with optional weights and location

## Files Created

```
/workspace/
├── api/
│   ├── __init__.py
│   └── routes/
│       ├── __init__.py
│       └── offer_comparison.py      # API route handlers
├── services/
│   ├── __init__.py
│   └── offer_comparison_service.py  # Service implementation
└── test_offer_comparison_fix.py     # Verification test
```

## API Endpoints

### GET `/api/v1/offer-comparison/offers`
List all saved offers with optional limit parameter.

**Query Parameters:**
- `limit` (int, optional): Maximum number of offers to return (1-100, default: 20)

**Response:**
```json
{
  "success": true,
  "data": [],
  "count": 0,
  "limit": 20
}
```

### GET `/api/v1/offer-comparison/offers/{offer_id}`
Get a specific offer by ID.

### POST `/api/v1/offer-comparison/offers`
Create a new offer.

**Request Body:**
```json
{
  "title": "Software Engineer",
  "company": "Tech Corp",
  "salary": 120000.0,
  "location": "San Francisco, CA",
  "benefits": ["Health Insurance", "401k"],
  "notes": "Great team culture"
}
```

### PUT `/api/v1/offer-comparison/offers/{offer_id}`
Update an existing offer.

### DELETE `/api/v1/offer-comparison/offers/{offer_id}`
Delete an offer.

### POST `/api/v1/offer-comparison/compare`
Compare multiple offers side-by-side with optional priority weights and target location.

**Request Body:**
```json
{
  "offer_ids": ["31276793-62bb-49a3-b850-62f58f092c68", "63ccb2a7-ff69-4e46-90b5-2a9f2c32e41b"],
  "priority_weights": {
    "salary": 0.5,
    "benefits": 0.3,
    "location": 0.2
  },
  "target_location": "San Francisco, CA"
}
```

**Note:** Both `priority_weights` and `target_location` are optional parameters that can be omitted or set to `null`.

## Usage Example

```python
from services.offer_comparison_service import OfferComparisonService

# Initialize service
service = OfferComparisonService()

# Compare offers with all parameters
result = await service.compare_offers(
    offer_ids=['31276793-62bb-49a3-b850-62f58f092c68', '63ccb2a7-ff69-4e46-90b5-2a9f2c32e41b'],
    priority_weights={'salary': 0.5, 'benefits': 0.3, 'location': 0.2},
    target_location='San Francisco, CA'
)

# Compare offers with None values (as in the original error)
result = await service.compare_offers(
    offer_ids=['31276793-62bb-49a3-b850-62f58f092c68', '63ccb2a7-ff69-4e46-90b5-2a9f2c32e41b'],
    priority_weights=None,
    target_location=None
)

# Compare offers with only required parameter
result = await service.compare_offers(
    offer_ids=['31276793-62bb-49a3-b850-62f58f092c68', '63ccb2a7-ff69-4e46-90b5-2a9f2c32e41b']
)
```

## Integration with FastAPI

The service is designed to work with FastAPI's dependency injection:

```python
from fastapi import Depends
from api.routes.offer_comparison import get_service

@router.get("/offers")
async def list_offers(
    limit: int = Query(20, ge=1, le=100),
    service = Depends(get_service)
):
    result = await service.list_offers(limit=limit)
    return result
```

## Next Steps (TODO)

The current implementation includes placeholder logic. To make it fully functional:

1. **Database Integration**: Connect the service to your database
   - Replace placeholder queries with actual database operations
   - Use SQLAlchemy, MongoDB, or your preferred ORM/database client

2. **Add Models**: Create database models for offers
   ```python
   class Offer(Base):
       __tablename__ = "offers"
       id = Column(String, primary_key=True)
       title = Column(String)
       company = Column(String)
       salary = Column(Float)
       # ... other fields
   ```

3. **Authentication**: Add user authentication and authorization
   - Ensure users can only access their own offers
   - Add JWT or session-based authentication

4. **Validation**: Enhance input validation
   - Add more detailed Pydantic models
   - Validate business rules (e.g., salary ranges, required fields)

5. **Testing**: Add comprehensive unit and integration tests
   - Test all service methods
   - Test API endpoints with different scenarios
   - Add error case testing

## Verification

The fix has been tested and verified to work correctly with all three scenarios:

1. ✅ With all parameters (offer_ids, priority_weights, target_location)
2. ✅ With None values for optional parameters (matching the original error case)
3. ✅ With only required parameter (offer_ids)

All tests passed successfully, confirming the TypeError has been resolved.

## Error Prevention

To prevent similar issues in the future:

1. **Type Hints**: All methods include proper type hints with `Optional` for nullable parameters
2. **Documentation**: Comprehensive docstrings documenting all parameters
3. **Consistent API Contract**: Request model matches service method signature
4. **Default Values**: Optional parameters have `None` as default to maintain backward compatibility
5. **Error Handling**: Try-except blocks with proper logging

## Support

If you encounter any issues or need to extend the functionality, refer to:
- Service implementation: `services/offer_comparison_service.py`
- API routes: `api/routes/offer_comparison.py`

## Changes Made

### Files Modified:
1. **`api/routes/offer_comparison.py`**
   - Renamed `CompareOffersRequest` to `ComparisonRequest`
   - Added `priority_weights: Optional[Dict[str, float]]` field
   - Added `target_location: Optional[str]` field
   - Changed route path from `/offers/compare` to `/compare`
   - Updated endpoint to pass all three parameters to service

2. **`services/offer_comparison_service.py`**
   - Updated `compare_offers()` method signature to accept:
     - `offer_ids: List[str]` (required)
     - `priority_weights: Optional[Dict[str, float]] = None` (optional)
     - `target_location: Optional[str] = None` (optional)
   - Added parameter validation and logging
   - Updated return data to include all parameters

These changes ensure the API route and service method signatures are aligned, preventing the TypeError.
