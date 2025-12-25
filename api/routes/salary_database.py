"""API routes for salary database endpoints."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from services.salary_database_service import SalaryDatabaseService


router = APIRouter(prefix="/api/v1/salary-database", tags=["salary-database"])


def get_service() -> SalaryDatabaseService:
    """Dependency injection for SalaryDatabaseService."""
    return SalaryDatabaseService()


@router.get("/companies")
async def get_companies(service: SalaryDatabaseService = Depends(get_service)):
    """Get list of all companies."""
    companies = await service.get_all_companies()
    return {"companies": companies}


@router.get("/company/{company_name}")
async def get_company_salaries(
    company_name: str,
    role: Optional[str] = None,
    level: Optional[str] = None,
    service: SalaryDatabaseService = Depends(get_service)
):
    """
    Get salary data for a specific company.
    
    Args:
        company_name: The name of the company to fetch salary data for
        role: Optional role filter
        level: Optional level filter
        service: Injected salary database service
        
    Returns:
        Company salary profile data
    """
    # Fixed: Changed parameter name from 'company_name' to 'company'
    result = await service.get_company_profile(
        company=company_name,  # Fixed: Use 'company' parameter name
        role_filter=role,
        level_filter=level
    )
    
    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"Company '{company_name}' not found"
        )
    
    return result


@router.get("/company/{company_name}/statistics")
async def get_company_statistics(
    company_name: str,
    role: Optional[str] = None,
    service: SalaryDatabaseService = Depends(get_service)
):
    """
    Get salary statistics for a specific company.
    
    Args:
        company_name: The name of the company
        role: Optional role filter
        service: Injected salary database service
        
    Returns:
        Salary statistics for the company
    """
    # Fixed: Use correct parameter name 'company' instead of 'company_name'
    stats = await service.get_salary_statistics(
        company=company_name,
        role=role
    )
    
    return stats
