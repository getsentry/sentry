"""BROKEN: Service implementation missing the priority_weights parameter."""

from typing import Optional


class OfferComparisonService:
    """Service for comparing job offers."""

    def __init__(self):
        self.offers_db = {}

    async def compare_offers(
        self,
        offer_ids: list[str],
        target_location: Optional[str] = None
        # BUG: Missing priority_weights parameter!
    ) -> dict:
        """
        Compare multiple offers side-by-side.

        Args:
            offer_ids: List of offer IDs to compare
            target_location: Optional target location for comparison

        Returns:
            Dictionary containing comparison results
        """
        # Simplified logic for demonstration
        offers = [
            {"id": offer_id, "title": f"Offer {i}"}
            for i, offer_id in enumerate(offer_ids)
        ]

        return {
            "offers": offers,
            "best_match": offer_ids[0] if offer_ids else None,
            "comparison_matrix": {},
        }
