"""FastAPI routes for Recruiter CRM endpoints."""

from fastapi import APIRouter, Depends, Query
from services.recruiter_crm_service import RecruiterCRMService


router = APIRouter(prefix="/api/v1/recruiter-crm", tags=["recruiter-crm"])


def get_service() -> RecruiterCRMService:
    """Dependency to get RecruiterCRMService instance."""
    return RecruiterCRMService()


@router.get("/analytics")
async def get_crm_analytics(
    days: int = Query(30, ge=7, le=365),
    service: RecruiterCRMService = Depends(get_service)
):
    """
    Get CRM analytics and insights.
    
    Args:
        days: Number of days to fetch analytics for (7-365, default: 30)
        service: Injected RecruiterCRMService instance
        
    Returns:
        Analytics data for the specified period
    """
    result = await service.get_analytics(days=days)
    return result


@router.get("/suggested-actions")
async def get_suggested_actions(
    service: RecruiterCRMService = Depends(get_service)
):
    """Get suggested actions based on CRM data."""
    # Placeholder implementation
    return {"suggested_actions": []}
