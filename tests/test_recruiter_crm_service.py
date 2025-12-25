"""Tests for Recruiter CRM Service."""

import pytest
from services.recruiter_crm_service import RecruiterCRMService


@pytest.mark.asyncio
async def test_get_analytics_with_days_parameter():
    """Test that get_analytics accepts days parameter."""
    service = RecruiterCRMService()
    
    # Test with default value
    result = await service.get_analytics()
    assert result is not None
    assert "period" in result
    assert result["period"]["days"] == 30
    
    # Test with custom value
    result = await service.get_analytics(days=60)
    assert result is not None
    assert "period" in result
    assert result["period"]["days"] == 60
    

@pytest.mark.asyncio
async def test_get_analytics_returns_expected_structure():
    """Test that get_analytics returns the expected data structure."""
    service = RecruiterCRMService()
    result = await service.get_analytics(days=30)
    
    # Verify structure
    assert "period" in result
    assert "metrics" in result
    assert "trends" in result
    
    # Verify period fields
    assert "start_date" in result["period"]
    assert "end_date" in result["period"]
    assert "days" in result["period"]
    
    # Verify metrics fields
    assert "total_interactions" in result["metrics"]
    assert "active_recruiters" in result["metrics"]
    assert "pending_follow_ups" in result["metrics"]
    assert "completed_interactions" in result["metrics"]
    
    # Verify trends fields
    assert "interaction_rate" in result["trends"]
    assert "response_rate" in result["trends"]
    assert "conversion_rate" in result["trends"]
