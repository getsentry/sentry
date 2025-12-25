"""Recruiter CRM API routes."""
from enum import Enum
from typing import Optional

from fastapi import APIRouter, Depends, Query

from services.recruiter_crm_service import RecruiterCRMService


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


def get_service() -> RecruiterCRMService:
    """Dependency injection for RecruiterCRMService."""
    return RecruiterCRMService()


router = APIRouter(prefix="/api/v1/recruiter-crm", tags=["recruiter-crm"])


@router.get("/recruiters")
async def list_recruiters(
    status: Optional[RecruiterStatus] = Query(None, description="Filter by recruiter status"),
    recruiter_type: Optional[RecruiterType] = Query(
        None, description="Filter by recruiter type", alias="recruiter_type"
    ),
    company: Optional[str] = Query(None, description="Filter by company name"),
    specialization: Optional[str] = Query(None, description="Filter by specialization"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    service: RecruiterCRMService = Depends(get_service),
):
    """List all recruiters in your CRM."""
    result = await service.list_recruiters(
        status=status.value if status else None,
        recruiter_type=recruiter_type.value if recruiter_type else None,
        company=company,
        specialization=specialization,
        limit=limit,
        offset=offset,
    )

    return result
