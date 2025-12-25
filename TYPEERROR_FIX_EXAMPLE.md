# TypeError Fix: RecruiterCRMService.add_recruiter() - Unexpected Keyword Argument

## Problem Description

The error occurs because the API endpoint is passing keyword arguments to the service method that the service method doesn't accept:

```
TypeError: RecruiterCRMService.add_recruiter() got an unexpected keyword argument 'specializations'
```

## Root Cause

The API layer (`api/routes/recruiter_crm.py`) and the service layer (`services/recruiter_crm_service.py`) have mismatched method signatures. The API is passing fields like `specializations`, `companies_recruited_for`, `notes`, and `tags` that the service method doesn't accept.

## The Fix

There are two approaches to fix this issue:

### Option 1: Update the Service Method (Recommended)

Update the `RecruiterCRMService.add_recruiter()` method to accept all the fields that the API is sending:

**Before (Broken):**
```python
# services/recruiter_crm_service.py
class RecruiterCRMService:
    async def add_recruiter(
        self,
        name: str,
        email: str,
        phone: str | None,
        linkedin_url: str | None,
        company: str | None,
        recruiter_type: RecruiterType,
    ) -> dict:
        # ... implementation
```

**After (Fixed):**
```python
# services/recruiter_crm_service.py
class RecruiterCRMService:
    async def add_recruiter(
        self,
        name: str,
        email: str,
        phone: str | None,
        linkedin_url: str | None,
        company: str | None,
        recruiter_type: RecruiterType,
        specializations: list[str] | None = None,
        companies_recruited_for: list[str] | None = None,
        notes: str | None = None,
        tags: list[str] | None = None,
    ) -> dict:
        # ... implementation that handles all fields
```

### Option 2: Update the API Endpoint

If the extra fields shouldn't be passed to the service, update the API endpoint to only pass the fields the service accepts:

**Before (Broken):**
```python
# api/routes/recruiter_crm.py
async def add_recruiter(
    request: RecruiterCreateRequest,
    service = Depends(get_service)
):
    """Add a new recruiter to your CRM."""
    result = await service.add_recruiter(
        name=request.name,
        email=request.email,
        phone=request.phone,
        linkedin_url=request.linkedin_url,
        company=request.company,
        recruiter_type=request.recruiter_type,
        specializations=request.specializations,  # CAUSES ERROR
        companies_recruited_for=request.companies_recruited_for,  # CAUSES ERROR
        notes=request.notes,  # CAUSES ERROR
        tags=request.tags,  # CAUSES ERROR
    )
    return result
```

**After (Fixed - Option 2A: Remove extra fields):**
```python
# api/routes/recruiter_crm.py
async def add_recruiter(
    request: RecruiterCreateRequest,
    service = Depends(get_service)
):
    """Add a new recruiter to your CRM."""
    result = await service.add_recruiter(
        name=request.name,
        email=request.email,
        phone=request.phone,
        linkedin_url=request.linkedin_url,
        company=request.company,
        recruiter_type=request.recruiter_type,
    )
    return result
```

**After (Fixed - Option 2B: Use **kwargs with filtering):**
```python
# api/routes/recruiter_crm.py
async def add_recruiter(
    request: RecruiterCreateRequest,
    service = Depends(get_service)
):
    """Add a new recruiter to your CRM."""
    # Only pass fields that the service accepts
    service_fields = {
        'name': request.name,
        'email': request.email,
        'phone': request.phone,
        'linkedin_url': request.linkedin_url,
        'company': request.company,
        'recruiter_type': request.recruiter_type,
    }
    result = await service.add_recruiter(**service_fields)
    return result
```

## Recommended Solution

**Option 1 is recommended** because:
1. The Pydantic model `RecruiterCreateRequest` already defines these fields
2. The API accepts and validates these fields
3. It's better to support all fields that clients can send
4. It maintains backward compatibility if the service already stores some of these fields elsewhere

## Implementation Steps for Option 1

1. **Update the service method signature** to accept the new parameters
2. **Update the service implementation** to handle the new fields (store them in database, etc.)
3. **Add tests** to verify the new fields are processed correctly
4. **Update documentation** if necessary

## Example Complete Fix (Option 1)

```python
# services/recruiter_crm_service.py
from typing import Optional
from models import Recruiter, RecruiterType

class RecruiterCRMService:
    async def add_recruiter(
        self,
        name: str,
        email: str,
        phone: Optional[str],
        linkedin_url: Optional[str],
        company: Optional[str],
        recruiter_type: RecruiterType,
        specializations: Optional[list[str]] = None,
        companies_recruited_for: Optional[list[str]] = None,
        notes: Optional[str] = None,
        tags: Optional[list[str]] = None,
    ) -> dict:
        """
        Add a new recruiter to the CRM system.
        
        Args:
            name: Full name of the recruiter
            email: Email address
            phone: Phone number (optional)
            linkedin_url: LinkedIn profile URL (optional)
            company: Company name (optional)
            recruiter_type: Type of recruiter (internal/external)
            specializations: List of specialization areas (optional)
            companies_recruited_for: List of companies they recruit for (optional)
            notes: Additional notes (optional)
            tags: List of tags for categorization (optional)
            
        Returns:
            dict: Created recruiter data including id
        """
        recruiter = Recruiter(
            name=name,
            email=email,
            phone=phone,
            linkedin_url=linkedin_url,
            company=company,
            recruiter_type=recruiter_type,
            specializations=specializations or [],
            companies_recruited_for=companies_recruited_for or [],
            notes=notes,
            tags=tags or [],
        )
        
        # Save to database
        await self.db.save(recruiter)
        
        return recruiter.to_dict()
```

## Verification

After applying the fix, verify:
1. The API endpoint can successfully create recruiters with all fields
2. Fields are properly stored in the database
3. Optional fields work correctly when not provided
4. Existing tests still pass
5. Add new tests for the additional fields

## Prevention

To prevent this issue in the future:
1. Use typed method signatures consistently
2. Keep API and service layer contracts in sync
3. Use integration tests that test the full stack
4. Consider using code generation or shared types between layers
5. Review both API and service changes together in PRs
