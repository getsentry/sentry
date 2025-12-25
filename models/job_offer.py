"""Pydantic models for job offer comparison."""
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class EquityType(str, Enum):
    """Type of equity compensation."""
    NONE = "none"
    RSU = "rsu"
    OPTIONS = "options"
    BOTH = "both"


class WorkArrangement(str, Enum):
    """Work arrangement type."""
    ONSITE = "onsite"
    HYBRID = "hybrid"
    REMOTE = "remote"


class JobOfferRequest(BaseModel):
    """Request model for adding a job offer."""
    company: str = Field(..., description="Company name")
    role: str = Field(..., description="Job role/title")
    location: str = Field(..., description="Job location")
    base_salary: float = Field(..., ge=0, description="Base annual salary")
    signing_bonus: float = Field(default=0, ge=0, description="Signing bonus")
    annual_bonus_target: float = Field(default=0, ge=0, description="Annual bonus target percentage")
    equity_value: float = Field(default=0, ge=0, description="Estimated equity value")
    equity_type: EquityType = Field(default=EquityType.NONE, description="Type of equity")
    equity_vesting_years: int = Field(default=4, ge=1, description="Equity vesting period in years")
    work_arrangement: WorkArrangement = Field(default=WorkArrangement.ONSITE, description="Work arrangement")
    benefits: Optional[str] = Field(default=None, description="Benefits description")
    pto_days: Optional[int] = Field(default=None, ge=0, description="PTO days per year")
    has_401k_match: bool = Field(default=False, description="Has 401k matching")
    match_percentage: Optional[float] = Field(default=None, ge=0, le=100, description="401k match percentage")
    has_espp: bool = Field(default=False, description="Has ESPP")
    espp_discount: Optional[float] = Field(default=None, ge=0, le=100, description="ESPP discount percentage")
    commute_time_minutes: Optional[int] = Field(default=None, ge=0, description="Commute time in minutes")
    notes: Optional[str] = Field(default=None, description="Additional notes")


class JobOfferResponse(BaseModel):
    """Response model for job offer operations."""
    id: str
    message: str
    total_compensation: float
