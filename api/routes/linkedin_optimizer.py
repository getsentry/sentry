"""LinkedIn Optimizer API routes."""

from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel, Field
from services.linkedin_optimizer_service import LinkedInOptimizerService

router = APIRouter(prefix="/api/v1/linkedin-optimizer", tags=["linkedin-optimizer"])


# Dependency to get service instance
def get_service() -> LinkedInOptimizerService:
    """Get LinkedIn Optimizer Service instance."""
    return LinkedInOptimizerService()


# Request/Response Models
class HeadlineGenerateRequest(BaseModel):
    """Request model for headline generation."""
    current_role: str = Field(..., description="Current job role")
    industry: str = Field(..., description="Industry")
    key_skills: list[str] = Field(..., description="List of key skills")


class AboutGenerateRequest(BaseModel):
    """Request model for about section generation."""
    background: str = Field(..., description="Professional background")
    achievements: list[str] = Field(..., description="Key achievements")
    target_audience: str = Field(..., description="Target audience")


class SuggestionsRequest(BaseModel):
    """Request model for profile suggestions."""
    profile_section: str = Field(..., description="Profile section to analyze")
    content: str = Field(..., description="Current content")


class KeywordAnalysisRequest(BaseModel):
    """Request model for keyword analysis."""
    profile_text: str = Field(..., description="Profile text to analyze")
    target_role: str = Field(..., description="Target role")


# Endpoints
@router.get("/best-practices")
async def get_best_practices(
    section: Optional[str] = Query(
        None,
        description="Specific section to get best practices for",
        pattern="^(headline|about|experience|skills|education)$"
    ),
    service: LinkedInOptimizerService = Depends(get_service)
):
    """Get LinkedIn best practices and tips."""
    try:
        result = await service.get_best_practices(section=section)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while fetching best practices: {str(e)}"
        )


@router.post("/headline/generate")
async def generate_headline(
    request: HeadlineGenerateRequest,
    service: LinkedInOptimizerService = Depends(get_service)
):
    """Generate optimized LinkedIn headline suggestions."""
    try:
        result = await service.generate_headline(
            current_role=request.current_role,
            industry=request.industry,
            key_skills=request.key_skills
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while generating headline: {str(e)}"
        )


@router.post("/about/generate")
async def generate_about(
    request: AboutGenerateRequest,
    service: LinkedInOptimizerService = Depends(get_service)
):
    """Generate optimized About section."""
    try:
        # Basic implementation - can be enhanced
        return {
            "suggestions": [
                f"Professional with background in {request.background}",
                f"Experienced in {request.background} with proven achievements"
            ],
            "tips": [
                "Start with a strong opening",
                "Include metrics and achievements",
                "End with a call-to-action"
            ]
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while generating about section: {str(e)}"
        )


@router.post("/suggestions")
async def get_suggestions(
    request: SuggestionsRequest,
    service: LinkedInOptimizerService = Depends(get_service)
):
    """Get improvement suggestions for a profile section."""
    try:
        result = await service.get_suggestions(
            profile_section=request.profile_section,
            content=request.content
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while getting suggestions: {str(e)}"
        )


@router.post("/keywords/analyze")
async def analyze_keywords(
    request: KeywordAnalysisRequest,
    service: LinkedInOptimizerService = Depends(get_service)
):
    """Analyze keyword optimization in profile."""
    try:
        result = await service.analyze_keywords(
            profile_text=request.profile_text,
            target_role=request.target_role
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while analyzing keywords: {str(e)}"
        )


@router.post("/action-words")
async def get_action_words(
    service: LinkedInOptimizerService = Depends(get_service)
):
    """Get categorized action words for profile descriptions."""
    try:
        result = await service.get_action_words()
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while fetching action words: {str(e)}"
        )


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "linkedin-optimizer"}
