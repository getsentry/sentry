"""API routes for offer comparison functionality."""
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
import logging

from services.offer_comparison_service import OfferComparisonService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/offer-comparison", tags=["offer-comparison"])


# Pydantic models for request/response validation
class OfferCreate(BaseModel):
    """Model for creating an offer."""
    title: str
    company: str
    salary: float
    location: str
    benefits: List[str] = []
    notes: str = ""


class OfferUpdate(BaseModel):
    """Model for updating an offer."""
    title: str | None = None
    company: str | None = None
    salary: float | None = None
    location: str | None = None
    benefits: List[str] | None = None
    notes: str | None = None


class CompareOffersRequest(BaseModel):
    """Model for comparing offers."""
    offer_ids: List[str]


# Dependency to get service instance
def get_service() -> OfferComparisonService:
    """
    Dependency injection for OfferComparisonService.
    
    Returns:
        An instance of OfferComparisonService
    """
    # TODO: Replace with proper dependency injection that includes database session
    # Example: 
    # db = get_db_session()
    # return OfferComparisonService(db=db)
    
    return OfferComparisonService()


@router.get("/offers")
async def list_offers(
    limit: int = Query(20, ge=1, le=100),
    service: OfferComparisonService = Depends(get_service)
):
    """
    List all saved offers.
    
    Args:
        limit: Maximum number of offers to return (1-100)
        service: Injected OfferComparisonService instance
        
    Returns:
        JSON response with list of offers
    """
    logger.info(f"GET /api/v1/offer-comparison/offers - limit={limit}")
    
    try:
        result = await service.list_offers(limit=limit)
        return result
    except Exception as e:
        logger.error(f"Error in list_offers endpoint: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list offers: {str(e)}"
        )


@router.get("/offers/{offer_id}")
async def get_offer(
    offer_id: str,
    service: OfferComparisonService = Depends(get_service)
):
    """
    Get a specific offer by ID.
    
    Args:
        offer_id: The unique identifier of the offer
        service: Injected OfferComparisonService instance
        
    Returns:
        JSON response with offer data
    """
    logger.info(f"GET /api/v1/offer-comparison/offers/{offer_id}")
    
    try:
        result = await service.get_offer(offer_id)
        
        if result is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Offer with ID {offer_id} not found"
            )
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_offer endpoint: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get offer: {str(e)}"
        )


@router.post("/offers")
async def create_offer(
    offer: OfferCreate,
    service: OfferComparisonService = Depends(get_service)
):
    """
    Create a new offer.
    
    Args:
        offer: The offer data to create
        service: Injected OfferComparisonService instance
        
    Returns:
        JSON response with created offer data
    """
    logger.info(f"POST /api/v1/offer-comparison/offers")
    
    try:
        result = await service.create_offer(offer.model_dump())
        return result
    except Exception as e:
        logger.error(f"Error in create_offer endpoint: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create offer: {str(e)}"
        )


@router.put("/offers/{offer_id}")
async def update_offer(
    offer_id: str,
    offer: OfferUpdate,
    service: OfferComparisonService = Depends(get_service)
):
    """
    Update an existing offer.
    
    Args:
        offer_id: The unique identifier of the offer
        offer: The updated offer data
        service: Injected OfferComparisonService instance
        
    Returns:
        JSON response with updated offer data
    """
    logger.info(f"PUT /api/v1/offer-comparison/offers/{offer_id}")
    
    try:
        # Filter out None values
        update_data = {k: v for k, v in offer.model_dump().items() if v is not None}
        
        result = await service.update_offer(offer_id, update_data)
        
        if result is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Offer with ID {offer_id} not found"
            )
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in update_offer endpoint: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update offer: {str(e)}"
        )


@router.delete("/offers/{offer_id}")
async def delete_offer(
    offer_id: str,
    service: OfferComparisonService = Depends(get_service)
):
    """
    Delete an offer.
    
    Args:
        offer_id: The unique identifier of the offer
        service: Injected OfferComparisonService instance
        
    Returns:
        JSON response confirming deletion
    """
    logger.info(f"DELETE /api/v1/offer-comparison/offers/{offer_id}")
    
    try:
        result = await service.delete_offer(offer_id)
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Offer with ID {offer_id} not found"
            )
        
        return {
            "success": True,
            "message": f"Offer {offer_id} deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in delete_offer endpoint: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete offer: {str(e)}"
        )


@router.post("/offers/compare")
async def compare_offers(
    request: CompareOffersRequest,
    service: OfferComparisonService = Depends(get_service)
):
    """
    Compare multiple offers.
    
    Args:
        request: Request containing list of offer IDs to compare
        service: Injected OfferComparisonService instance
        
    Returns:
        JSON response with comparison data
    """
    logger.info(f"POST /api/v1/offer-comparison/offers/compare - {len(request.offer_ids)} offers")
    
    try:
        if len(request.offer_ids) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least 2 offers are required for comparison"
            )
        
        result = await service.compare_offers(request.offer_ids)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in compare_offers endpoint: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compare offers: {str(e)}"
        )
