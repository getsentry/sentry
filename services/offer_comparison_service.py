"""Service for comparing job offers."""
from typing import Optional
import uuid


class OfferComparisonService:
    """Service to manage and compare job offers."""
    
    def __init__(self):
        """Initialize the service with an empty offers storage."""
        self.offers = {}
    
    async def add_offer(
        self,
        company: str,  # FIX: Added company parameter that was missing
        role: str,
        location: str,
        base_salary: float,
        signing_bonus: float = 0,
        annual_bonus_target: float = 0,
        equity_value: float = 0,
        equity_type: str = "none",
        equity_vesting_years: int = 4,
        work_arrangement: str = "onsite",
        benefits: Optional[str] = None,
        pto_days: Optional[int] = None,
        has_401k_match: bool = False,
        match_percentage: Optional[float] = None,
        has_espp: bool = False,
        espp_discount: Optional[float] = None,
        commute_time_minutes: Optional[int] = None,
        notes: Optional[str] = None,
    ) -> dict:
        """
        Add a new job offer to the comparison.
        
        Args:
            company: Company name (FIXED: was missing in original implementation)
            role: Job role/title
            location: Job location
            base_salary: Base annual salary
            signing_bonus: Signing bonus amount
            annual_bonus_target: Target annual bonus percentage
            equity_value: Estimated equity value
            equity_type: Type of equity compensation
            equity_vesting_years: Years for equity vesting
            work_arrangement: Type of work arrangement
            benefits: Benefits description
            pto_days: PTO days per year
            has_401k_match: Whether 401k matching is offered
            match_percentage: 401k match percentage
            has_espp: Whether ESPP is offered
            espp_discount: ESPP discount percentage
            commute_time_minutes: Commute time in minutes
            notes: Additional notes
            
        Returns:
            Dictionary with offer ID, message, and total compensation
        """
        # Generate a unique ID for this offer
        offer_id = str(uuid.uuid4())
        
        # Calculate total compensation
        # Simple calculation: base + signing bonus (first year) + annual bonus + equity/vesting years
        total_compensation = (
            base_salary 
            + signing_bonus 
            + (base_salary * annual_bonus_target / 100)
            + (equity_value / equity_vesting_years)
        )
        
        # Store the offer
        self.offers[offer_id] = {
            "id": offer_id,
            "company": company,
            "role": role,
            "location": location,
            "base_salary": base_salary,
            "signing_bonus": signing_bonus,
            "annual_bonus_target": annual_bonus_target,
            "equity_value": equity_value,
            "equity_type": equity_type,
            "equity_vesting_years": equity_vesting_years,
            "work_arrangement": work_arrangement,
            "benefits": benefits,
            "pto_days": pto_days,
            "has_401k_match": has_401k_match,
            "match_percentage": match_percentage,
            "has_espp": has_espp,
            "espp_discount": espp_discount,
            "commute_time_minutes": commute_time_minutes,
            "notes": notes,
            "total_compensation": total_compensation,
        }
        
        return {
            "id": offer_id,
            "message": f"Successfully added offer from {company}",
            "total_compensation": total_compensation,
        }
    
    async def get_offers(self) -> list:
        """Get all stored offers."""
        return list(self.offers.values())
    
    async def get_offer(self, offer_id: str) -> Optional[dict]:
        """Get a specific offer by ID."""
        return self.offers.get(offer_id)
    
    async def delete_offer(self, offer_id: str) -> bool:
        """Delete an offer by ID."""
        if offer_id in self.offers:
            del self.offers[offer_id]
            return True
        return False
    
    async def compare_offers(self, offer_ids: list[str]) -> dict:
        """Compare multiple offers side by side."""
        offers_to_compare = [
            self.offers[offer_id] 
            for offer_id in offer_ids 
            if offer_id in self.offers
        ]
        
        if not offers_to_compare:
            return {"error": "No valid offers found"}
        
        # Sort by total compensation
        offers_to_compare.sort(key=lambda x: x["total_compensation"], reverse=True)
        
        return {
            "offers": offers_to_compare,
            "best_offer": offers_to_compare[0] if offers_to_compare else None,
        }
