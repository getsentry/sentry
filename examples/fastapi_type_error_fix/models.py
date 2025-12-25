"""Request and response models for the offer comparison API."""

from typing import Optional
from pydantic import BaseModel


class ComparisonRequest(BaseModel):
    """Request model for comparing offers."""
    offer_ids: list[str]
    priority_weights: Optional[dict[str, float]] = None
    target_location: Optional[str] = None


class ComparisonResult(BaseModel):
    """Result of comparing offers."""
    offers: list[dict]
    best_match: Optional[str] = None
    comparison_matrix: Optional[dict] = None
