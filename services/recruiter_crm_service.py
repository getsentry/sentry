"""Recruiter CRM Service - Handles business logic for recruiter management."""
from datetime import datetime
from typing import Optional
from uuid import uuid4


class RecruiterCRMService:
    """Service class for managing recruiters in the CRM system."""

    def __init__(self):
        """Initialize the service with an in-memory database."""
        self.recruiters = {}

    async def add_recruiter(
        self,
        name: str,
        email: str,
        phone: Optional[str] = None,
        linkedin_url: Optional[str] = None,
        company: Optional[str] = None,
        recruiter_type: str = "external",
        specializations: Optional[list[str]] = None,  # FIXED: Added missing parameter
        companies_recruited_for: Optional[list[str]] = None,
        notes: Optional[str] = None,
        tags: Optional[list[str]] = None,
    ) -> dict:
        """
        Add a new recruiter to the CRM system.

        Args:
            name: Recruiter's full name
            email: Recruiter's email address
            phone: Optional phone number
            linkedin_url: Optional LinkedIn profile URL
            company: Optional company name
            recruiter_type: Type of recruiter (internal, external, agency)
            specializations: Optional list of recruitment specializations
            companies_recruited_for: Optional list of companies recruited for
            notes: Optional notes about the recruiter
            tags: Optional tags for categorization

        Returns:
            dict: Created recruiter data with generated ID and timestamps
        """
        recruiter_id = str(uuid4())
        now = datetime.utcnow().isoformat()

        recruiter_data = {
            "id": recruiter_id,
            "name": name,
            "email": email,
            "phone": phone,
            "linkedin_url": linkedin_url,
            "company": company,
            "recruiter_type": recruiter_type,
            "specializations": specializations or [],
            "companies_recruited_for": companies_recruited_for or [],
            "notes": notes,
            "tags": tags or [],
            "created_at": now,
            "updated_at": now,
        }

        self.recruiters[recruiter_id] = recruiter_data
        return recruiter_data

    async def get_recruiter(self, recruiter_id: str) -> Optional[dict]:
        """Get a recruiter by ID."""
        return self.recruiters.get(recruiter_id)

    async def list_recruiters(
        self,
        skip: int = 0,
        limit: int = 100,
        recruiter_type: Optional[str] = None,
    ) -> list[dict]:
        """List all recruiters with optional filtering."""
        recruiters = list(self.recruiters.values())
        
        if recruiter_type:
            recruiters = [r for r in recruiters if r["recruiter_type"] == recruiter_type]
        
        return recruiters[skip : skip + limit]

    async def update_recruiter(
        self,
        recruiter_id: str,
        **kwargs
    ) -> Optional[dict]:
        """Update an existing recruiter."""
        if recruiter_id not in self.recruiters:
            return None

        recruiter = self.recruiters[recruiter_id]
        for key, value in kwargs.items():
            if key in recruiter and value is not None:
                recruiter[key] = value
        
        recruiter["updated_at"] = datetime.utcnow().isoformat()
        return recruiter

    async def delete_recruiter(self, recruiter_id: str) -> bool:
        """Delete a recruiter."""
        if recruiter_id in self.recruiters:
            del self.recruiters[recruiter_id]
            return True
        return False
