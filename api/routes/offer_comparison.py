"""Offer Comparison API Routes"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Any, Dict, List
from services.offer_comparison_service import OfferComparisonService


router = APIRouter(
    prefix="/api/v1/offer-comparison",
    tags=["offer-comparison"]
)


def get_service() -> OfferComparisonService:
    """
    Dependency function to get the OfferComparisonService instance.
    
    Returns:
        OfferComparisonService: An instance of the service
    """
    # In a real application, this might include database session injection
    return OfferComparisonService()


@router.get("/offers")
async def list_offers(
    limit: int = Query(20, ge=1, le=100),
    service: OfferComparisonService = Depends(get_service)
):
    """
    List all saved offers.
    
    Args:
        limit: Maximum number of offers to return (default: 20, min: 1, max: 100)
        service: Injected OfferComparisonService instance
        
    Returns:
        Dict containing list of offers and metadata
    """
    result = await service.list_offers(limit=limit)
    return result


@router.get("/offers/{offer_id}")
async def get_offer(
    offer_id: int,
    service: OfferComparisonService = Depends(get_service)
):
    """
    Get a specific offer by ID.
    
    Args:
        offer_id: The ID of the offer to retrieve
        service: Injected OfferComparisonService instance
        
    Returns:
        Dict containing offer details
        
    Raises:
        HTTPException: 404 if offer not found
    """
    result = await service.get_offer(offer_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Offer {offer_id} not found")
    return result


@router.post("/offers")
async def create_offer(
    offer_data: Dict[str, Any],
    service: OfferComparisonService = Depends(get_service)
):
    """
    Create a new offer.
    
    Args:
        offer_data: Dictionary containing offer information
        service: Injected OfferComparisonService instance
        
    Returns:
        Dict containing created offer details
    """
    result = await service.create_offer(offer_data)
    return result


@router.put("/offers/{offer_id}")
async def update_offer(
    offer_id: int,
    offer_data: Dict[str, Any],
    service: OfferComparisonService = Depends(get_service)
):
    """
    Update an existing offer.
    
    Args:
        offer_id: The ID of the offer to update
        offer_data: Dictionary containing updated offer information
        service: Injected OfferComparisonService instance
        
    Returns:
        Dict containing updated offer details
        
    Raises:
        HTTPException: 404 if offer not found
    """
    result = await service.update_offer(offer_id, offer_data)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Offer {offer_id} not found")
    return result


@router.delete("/offers/{offer_id}")
async def delete_offer(
    offer_id: int,
    service: OfferComparisonService = Depends(get_service)
):
    """
    Delete an offer.
    
    Args:
        offer_id: The ID of the offer to delete
        service: Injected OfferComparisonService instance
        
    Returns:
        Dict containing success message
        
    Raises:
        HTTPException: 404 if offer not found
    """
    deleted = await service.delete_offer(offer_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Offer {offer_id} not found")
    
    return {
        "success": True,
        "message": f"Offer {offer_id} deleted successfully"
    }


@router.post("/offers/compare")
async def compare_offers(
    offer_ids: List[int],
    service: OfferComparisonService = Depends(get_service)
):
    """
    Compare multiple offers.
    
    Args:
        offer_ids: List of offer IDs to compare
        service: Injected OfferComparisonService instance
        
    Returns:
        Dict containing comparison results
    """
    if len(offer_ids) < 2:
        raise HTTPException(
            status_code=400,
            detail="At least 2 offers are required for comparison"
        )
    
    result = await service.compare_offers(offer_ids)
    return result
