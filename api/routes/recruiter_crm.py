"""API routes for Recruiter CRM endpoints."""
from typing import Optional
from enum import Enum

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel

from services.recruiter_crm_service import RecruiterCRMService


# Define enums for status and recruiter type
class RecruiterStatus(str, Enum):
    """Enum for recruiter status values."""
    ACTIVE = "active"
    INACTIVE = "inactive"
    PENDING = "pending"


class RecruiterType(str, Enum):
    """Enum for recruiter type values."""
    INTERNAL = "internal"
    EXTERNAL = "external"
    AGENCY = "agency"


# Response models
class RecruiterListResponse(BaseModel):
    """Response model for list recruiters endpoint."""
    recruiters: list
    total: int
    limit: int
    offset: int
    filters: dict


# Create router
router = APIRouter(prefix="/api/v1/recruiter-crm", tags=["recruiter-crm"])


# Dependency to get service instance
def get_service() -> RecruiterCRMService:
    """Dependency that provides RecruiterCRMService instance.
    
    Returns:
        RecruiterCRMService instance
    """
    # In a real application, this might include database session injection
    return RecruiterCRMService()


@router.get("/recruiters", response_model=RecruiterListResponse)
async def list_recruiters(
    status: Optional[RecruiterStatus] = Query(None, description="Filter by recruiter status"),
    recruiter_type: Optional[RecruiterType] = Query(None, description="Filter by recruiter type"),
    company: Optional[str] = Query(None, description="Filter by company name"),
    specialization: Optional[str] = Query(None, description="Filter by specialization"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    service: RecruiterCRMService = Depends(get_service)
) -> RecruiterListResponse:
    """List all recruiters in your CRM.
    
    Args:
        status: Filter by recruiter status
        recruiter_type: Filter by recruiter type
        company: Filter by company name
        specialization: Filter by specialization area
        limit: Maximum number of results to return (1-200)
        offset: Number of results to skip for pagination
        service: Injected RecruiterCRMService instance
        
    Returns:
        RecruiterListResponse with recruiters and pagination info
    """
    result = await service.list_recruiters(
        status=status.value if status else None,
        recruiter_type=recruiter_type.value if recruiter_type else None,
        company=company,
        specialization=specialization,
        limit=limit,
        offset=offset
    )
    
    return RecruiterListResponse(**result)


@router.get("/recruiters/{recruiter_id}")
async def get_recruiter(
    recruiter_id: int,
    service: RecruiterCRMService = Depends(get_service)
):
    """Get a single recruiter by ID.
    
    Args:
        recruiter_id: The ID of the recruiter to retrieve
        service: Injected RecruiterCRMService instance
        
    Returns:
        Recruiter data
        
    Raises:
        HTTPException: 404 if recruiter not found
    """
    recruiter = await service.get_recruiter(recruiter_id)
    if not recruiter:
        raise HTTPException(status_code=404, detail="Recruiter not found")
    return recruiter


@router.post("/recruiters")
async def create_recruiter(
    recruiter_data: dict,
    service: RecruiterCRMService = Depends(get_service)
):
    """Create a new recruiter.
    
    Args:
        recruiter_data: Recruiter information
        service: Injected RecruiterCRMService instance
        
    Returns:
        Created recruiter data
    """
    return await service.create_recruiter(recruiter_data)


@router.put("/recruiters/{recruiter_id}")
async def update_recruiter(
    recruiter_id: int,
    recruiter_data: dict,
    service: RecruiterCRMService = Depends(get_service)
):
    """Update an existing recruiter.
    
    Args:
        recruiter_id: The ID of the recruiter to update
        recruiter_data: Updated recruiter information
        service: Injected RecruiterCRMService instance
        
    Returns:
        Updated recruiter data
        
    Raises:
        HTTPException: 404 if recruiter not found
    """
    result = await service.update_recruiter(recruiter_id, recruiter_data)
    if not result:
        raise HTTPException(status_code=404, detail="Recruiter not found")
    return result


@router.delete("/recruiters/{recruiter_id}")
async def delete_recruiter(
    recruiter_id: int,
    service: RecruiterCRMService = Depends(get_service)
):
    """Delete a recruiter.
    
    Args:
        recruiter_id: The ID of the recruiter to delete
        service: Injected RecruiterCRMService instance
        
    Returns:
        Success message
        
    Raises:
        HTTPException: 404 if recruiter not found
    """
    success = await service.delete_recruiter(recruiter_id)
    if not success:
        raise HTTPException(status_code=404, detail="Recruiter not found")
    return {"message": "Recruiter deleted successfully"}
