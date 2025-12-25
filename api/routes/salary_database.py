"""Salary Database API Routes."""
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException

from services.salary_database_service import SalaryDatabaseService


router = APIRouter(prefix="/api/v1/salary-database", tags=["salary-database"])


def get_service() -> SalaryDatabaseService:
    """Dependency injection for SalaryDatabaseService."""
    return SalaryDatabaseService()


@router.get("/company/{company_name}")
async def get_company_salaries(
    company_name: str,
    role: Optional[str] = None,
    level: Optional[str] = None,
    service: SalaryDatabaseService = Depends(get_service)
) -> Dict[str, Any]:
    """Get salary data for a specific company."""
    result = await service.get_company_profile(
        company_name=company_name,
        role_filter=role,
        level_filter=level
    )
    if not result:
        raise HTTPException(status_code=404, detail="Company not found")
    return result
