"""Recruiter CRM API routes."""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional

from models.recruiter import RecruiterCreateRequest, RecruiterResponse
from services.recruiter_crm_service import RecruiterCRMService


router = APIRouter(prefix="/api/v1/recruiter-crm", tags=["recruiter-crm"])

# Global service instance (in production, use proper dependency injection)
_service_instance = None


def get_service() -> RecruiterCRMService:
    """Dependency to get the service instance."""
    global _service_instance
    if _service_instance is None:
        _service_instance = RecruiterCRMService()
    return _service_instance


@router.post("/recruiters", response_model=RecruiterResponse, status_code=status.HTTP_201_CREATED)
async def add_recruiter(
    request: RecruiterCreateRequest,
    service: RecruiterCRMService = Depends(get_service)
):
    """Add a new recruiter to your CRM."""
    result = await service.add_recruiter(
        name=request.name,
        email=request.email,
        phone=request.phone,
        linkedin_url=request.linkedin_url,
        company=request.company,
        recruiter_type=request.recruiter_type.value,
        specializations=request.specializations,  # FIXED: Now properly passed to service
        companies_recruited_for=request.companies_recruited_for,
        notes=request.notes,
        tags=request.tags,
    )
    return result


@router.get("/recruiters/{recruiter_id}", response_model=RecruiterResponse)
async def get_recruiter(
    recruiter_id: str,
    service: RecruiterCRMService = Depends(get_service)
):
    """Get a specific recruiter by ID."""
    recruiter = await service.get_recruiter(recruiter_id)
    if not recruiter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recruiter with ID {recruiter_id} not found"
        )
    return recruiter


@router.get("/recruiters", response_model=list[RecruiterResponse])
async def list_recruiters(
    skip: int = 0,
    limit: int = 100,
    recruiter_type: Optional[str] = None,
    service: RecruiterCRMService = Depends(get_service)
):
    """List all recruiters with optional filtering."""
    return await service.list_recruiters(
        skip=skip,
        limit=limit,
        recruiter_type=recruiter_type
    )


@router.put("/recruiters/{recruiter_id}", response_model=RecruiterResponse)
async def update_recruiter(
    recruiter_id: str,
    request: RecruiterCreateRequest,
    service: RecruiterCRMService = Depends(get_service)
):
    """Update an existing recruiter."""
    result = await service.update_recruiter(
        recruiter_id=recruiter_id,
        name=request.name,
        email=request.email,
        phone=request.phone,
        linkedin_url=request.linkedin_url,
        company=request.company,
        recruiter_type=request.recruiter_type.value,
        specializations=request.specializations,
        companies_recruited_for=request.companies_recruited_for,
        notes=request.notes,
        tags=request.tags,
    )
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recruiter with ID {recruiter_id} not found"
        )
    return result


@router.delete("/recruiters/{recruiter_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recruiter(
    recruiter_id: str,
    service: RecruiterCRMService = Depends(get_service)
):
    """Delete a recruiter."""
    success = await service.delete_recruiter(recruiter_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recruiter with ID {recruiter_id} not found"
        )
