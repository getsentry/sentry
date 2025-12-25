"""FastAPI routes for job offer comparison."""
from fastapi import APIRouter, Depends, HTTPException
from models.job_offer import JobOfferRequest, JobOfferResponse
from services.offer_comparison_service import OfferComparisonService


router = APIRouter(prefix="/api/v1/offer-comparison", tags=["offer-comparison"])


# Service instance (in production, you'd use proper dependency injection)
_service_instance = None


def get_service() -> OfferComparisonService:
    """Dependency to get the offer comparison service instance."""
    global _service_instance
    if _service_instance is None:
        _service_instance = OfferComparisonService()
    return _service_instance


@router.post("/offers", response_model=JobOfferResponse)
async def add_offer(
    request: JobOfferRequest,
    service: OfferComparisonService = Depends(get_service)
):
    """
    Add a job offer for comparison.
    
    This endpoint accepts all job offer details and stores them for comparison.
    The fix here ensures that all parameters from the request model are properly
    passed to the service layer, including the 'company' parameter.
    """
    # FIX: Pass all parameters from the request to the service
    # The original error was that 'company' was being passed but not accepted by the service
    result = await service.add_offer(
        company=request.company,  # This parameter is now properly accepted by the service
        role=request.role,
        location=request.location,
        base_salary=request.base_salary,
        signing_bonus=request.signing_bonus,
        annual_bonus_target=request.annual_bonus_target,
        equity_value=request.equity_value,
        equity_type=request.equity_type.value,
        equity_vesting_years=request.equity_vesting_years,
        work_arrangement=request.work_arrangement.value,
        benefits=request.benefits,
        pto_days=request.pto_days,
        has_401k_match=request.has_401k_match,
        match_percentage=request.match_percentage,
        has_espp=request.has_espp,
        espp_discount=request.espp_discount,
        commute_time_minutes=request.commute_time_minutes,
        notes=request.notes,
    )
    
    return JobOfferResponse(**result)


@router.get("/offers")
async def get_offers(service: OfferComparisonService = Depends(get_service)):
    """Get all job offers."""
    offers = await service.get_offers()
    return {"offers": offers}


@router.get("/offers/{offer_id}")
async def get_offer(offer_id: str, service: OfferComparisonService = Depends(get_service)):
    """Get a specific job offer by ID."""
    offer = await service.get_offer(offer_id)
    if offer is None:
        raise HTTPException(status_code=404, detail="Offer not found")
    return offer


@router.delete("/offers/{offer_id}")
async def delete_offer(offer_id: str, service: OfferComparisonService = Depends(get_service)):
    """Delete a job offer by ID."""
    success = await service.delete_offer(offer_id)
    if not success:
        raise HTTPException(status_code=404, detail="Offer not found")
    return {"message": "Offer deleted successfully"}


@router.post("/offers/compare")
async def compare_offers(
    offer_ids: list[str],
    service: OfferComparisonService = Depends(get_service)
):
    """Compare multiple job offers."""
    result = await service.compare_offers(offer_ids)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result
