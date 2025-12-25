"""FastAPI routes for offer comparison."""

from fastapi import APIRouter, Depends
from models import ComparisonRequest, ComparisonResult


router = APIRouter(prefix="/api/v1/offer-comparison")


def get_service():
    """Dependency to get the service instance."""
    from service_fixed import OfferComparisonService  # Use fixed version
    return OfferComparisonService()


@router.post("/compare", response_model=ComparisonResult)
async def compare_offers(
    request: ComparisonRequest,
    service=Depends(get_service)
):
    """
    Compare multiple offers side-by-side.

    This endpoint receives a request with offer_ids, priority_weights, and target_location,
    and passes all of them to the service method.

    The bug occurred because the service method signature was missing the priority_weights
    parameter, causing a TypeError when this route tried to call it.
    """
    result = await service.compare_offers(
        offer_ids=request.offer_ids,
        priority_weights=request.priority_weights,  # This parameter must exist in service
        target_location=request.target_location
    )
    return result
