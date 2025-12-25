"""Recruiter CRM models."""
from enum import Enum
from typing import Optional
from pydantic import BaseModel, EmailStr


class RecruiterType(str, Enum):
    """Recruiter type enumeration."""
    INTERNAL = "internal"
    EXTERNAL = "external"
    AGENCY = "agency"


class RecruiterCreateRequest(BaseModel):
    """Request model for creating a recruiter."""
    name: str
    email: EmailStr
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    company: Optional[str] = None
    recruiter_type: RecruiterType = RecruiterType.EXTERNAL
    specializations: Optional[list[str]] = None
    companies_recruited_for: Optional[list[str]] = None
    notes: Optional[str] = None
    tags: Optional[list[str]] = None


class RecruiterResponse(BaseModel):
    """Response model for recruiter operations."""
    id: str
    name: str
    email: str
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    company: Optional[str] = None
    recruiter_type: RecruiterType
    specializations: Optional[list[str]] = None
    companies_recruited_for: Optional[list[str]] = None
    notes: Optional[str] = None
    tags: Optional[list[str]] = None
    created_at: str
    updated_at: str
