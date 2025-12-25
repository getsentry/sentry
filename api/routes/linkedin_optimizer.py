"""LinkedIn Optimizer API Routes

This module provides FastAPI routes for LinkedIn profile optimization.
"""

from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Query
from services.linkedin_optimizer_service import LinkedInOptimizerService


router = APIRouter(prefix="/api/v1/linkedin-optimizer", tags=["linkedin-optimizer"])


def get_service() -> LinkedInOptimizerService:
    """Dependency to get the LinkedIn Optimizer Service instance.

    Returns:
        LinkedInOptimizerService: An instance of the service
    """
    return LinkedInOptimizerService()


@router.get("/best-practices")
async def get_best_practices(
    section: Optional[str] = Query(
        None,
        description="Specific section to get best practices for",
        pattern="^(headline|about|experience|skills|education)$",
    ),
    service: LinkedInOptimizerService = Depends(get_service),
) -> Dict[str, Any]:
    """Get LinkedIn best practices and tips.

    Args:
        section: Optional section filter (headline, about, experience, skills, education)
        service: Injected LinkedIn Optimizer Service

    Returns:
        Dictionary containing best practices, tips, and examples
    """
    result = await service.get_best_practices(section=section)
    return result


@router.post("/headline/generate")
async def generate_headline(
    profile_data: Dict[str, Any],
    service: LinkedInOptimizerService = Depends(get_service),
) -> Dict[str, Any]:
    """Generate an optimized LinkedIn headline.

    Args:
        profile_data: User profile information
        service: Injected LinkedIn Optimizer Service

    Returns:
        Generated headline suggestions
    """
    result = await service.generate_headline(profile_data)
    return result


@router.post("/about/generate")
async def generate_about(
    profile_data: Dict[str, Any],
    service: LinkedInOptimizerService = Depends(get_service),
) -> Dict[str, Any]:
    """Generate an optimized About section.

    Args:
        profile_data: User profile information
        service: Injected LinkedIn Optimizer Service

    Returns:
        Generated about section suggestions
    """
    result = await service.generate_about(profile_data)
    return result


@router.post("/suggestions")
async def get_suggestions(
    profile_data: Dict[str, Any],
    service: LinkedInOptimizerService = Depends(get_service),
) -> Dict[str, Any]:
    """Get profile optimization suggestions.

    Args:
        profile_data: User profile information
        service: Injected LinkedIn Optimizer Service

    Returns:
        List of suggestions for profile improvement
    """
    result = await service.get_suggestions(profile_data)
    return result


@router.post("/keywords/analyze")
async def analyze_keywords(
    text: str,
    service: LinkedInOptimizerService = Depends(get_service),
) -> Dict[str, Any]:
    """Analyze keywords in profile text.

    Args:
        text: Text content to analyze
        service: Injected LinkedIn Optimizer Service

    Returns:
        Keyword analysis results
    """
    result = await service.analyze_keywords(text)
    return result


@router.post("/action-words")
async def get_action_words(
    service: LinkedInOptimizerService = Depends(get_service),
) -> Dict[str, Any]:
    """Get action words for experience descriptions.

    Args:
        service: Injected LinkedIn Optimizer Service

    Returns:
        List of recommended action words by category
    """
    result = await service.get_action_words()
    return result
