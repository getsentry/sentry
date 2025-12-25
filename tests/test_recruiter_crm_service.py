"""Tests for RecruiterCRMService."""
import pytest
from services.recruiter_crm_service import RecruiterCRMService


@pytest.mark.asyncio
async def test_list_recruiters_no_filters():
    """Test listing recruiters without filters."""
    service = RecruiterCRMService()
    
    result = await service.list_recruiters()
    
    assert "recruiters" in result
    assert "total" in result
    assert "limit" in result
    assert "offset" in result
    assert result["limit"] == 50
    assert result["offset"] == 0
    assert isinstance(result["recruiters"], list)


@pytest.mark.asyncio
async def test_list_recruiters_with_filters():
    """Test listing recruiters with filters."""
    service = RecruiterCRMService()
    
    result = await service.list_recruiters(
        status="active",
        recruiter_type="external",
        company="TechCorp",
        specialization="Software Engineering",
        limit=10,
        offset=5
    )
    
    assert result["limit"] == 10
    assert result["offset"] == 5
    assert result["filters"]["status"] == "active"
    assert result["filters"]["recruiter_type"] == "external"
    assert result["filters"]["company"] == "TechCorp"
    assert result["filters"]["specialization"] == "Software Engineering"


@pytest.mark.asyncio
async def test_list_recruiters_custom_pagination():
    """Test listing recruiters with custom pagination."""
    service = RecruiterCRMService()
    
    result = await service.list_recruiters(limit=100, offset=50)
    
    assert result["limit"] == 100
    assert result["offset"] == 50


@pytest.mark.asyncio
async def test_get_recruiter():
    """Test getting a single recruiter."""
    service = RecruiterCRMService()
    
    result = await service.get_recruiter(1)
    
    # Should return None since no database is connected
    assert result is None


@pytest.mark.asyncio
async def test_create_recruiter():
    """Test creating a recruiter."""
    service = RecruiterCRMService()
    
    recruiter_data = {
        "name": "John Doe",
        "email": "john@example.com",
        "company": "TechCorp"
    }
    
    result = await service.create_recruiter(recruiter_data)
    
    assert result == recruiter_data


@pytest.mark.asyncio
async def test_update_recruiter():
    """Test updating a recruiter."""
    service = RecruiterCRMService()
    
    recruiter_data = {"name": "Jane Doe"}
    
    result = await service.update_recruiter(1, recruiter_data)
    
    # Should return None since no database is connected
    assert result is None


@pytest.mark.asyncio
async def test_delete_recruiter():
    """Test deleting a recruiter."""
    service = RecruiterCRMService()
    
    result = await service.delete_recruiter(1)
    
    # Should return False since no database is connected
    assert result is False
