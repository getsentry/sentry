"""Recruiter CRM API routes."""
from typing import Optional
from enum import Enum
from fastapi import APIRouter, Depends
from services.recruiter_crm_service import RecruiterCRMService


class Priority(str, Enum):
    """Priority levels for follow-ups."""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


router = APIRouter(prefix="/api/v1/recruiter-crm", tags=["recruiter-crm"])


def get_service() -> RecruiterCRMService:
    """Dependency injection for RecruiterCRMService."""
    return RecruiterCRMService()


@router.get("/follow-ups")
async def get_pending_follow_ups(
    priority: Optional[Priority] = None,
    due_before: Optional[str] = None,
    service: RecruiterCRMService = Depends(get_service)
):
    """Get all pending follow-ups."""
    result = await service.get_pending_follow_ups(
        priority=priority.value if priority else None,
        due_before=due_before
    )
    return result


@router.get("/recruiters")
async def get_recruiters(
    service: RecruiterCRMService = Depends(get_service)
):
    """Get all recruiters."""
    result = await service.get_recruiters()
    return result


@router.post("/recruiters")
async def create_recruiter(
    recruiter_data: dict,
    service: RecruiterCRMService = Depends(get_service)
):
    """Create a new recruiter."""
    result = await service.create_recruiter(recruiter_data)
    return result


@router.post("/interactions")
async def create_interaction(
    interaction_data: dict,
    service: RecruiterCRMService = Depends(get_service)
):
    """Create a new interaction."""
    result = await service.create_interaction(interaction_data)
    return result
