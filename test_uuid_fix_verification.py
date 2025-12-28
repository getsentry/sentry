"""
Verification test for the UUID fix in email monitoring API.

This test demonstrates the fix for the issue:
StatementError: (builtins.AttributeError) 'str' object has no attribute 'hex'

The issue occurred because get_user_id_from_token returned a string UUID,
but SQLAlchemy's UUID bind processor expected a UUID object with a .hex attribute.
"""
import uuid
from datetime import datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from api.models.email_monitoring_config import Base, EmailMonitoringConfig
from api.routes.email_monitoring import get_user_id_from_token
from api.utils import ensure_uuid


@pytest.fixture
def db_session():
    """Create an in-memory SQLite database for testing."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    
    yield session
    
    session.close()


@pytest.fixture
def sample_user_id_string():
    """Return the sample UUID as a string (simulating the bug scenario)."""
    return "00000000-0000-0000-0000-000000000001"


@pytest.fixture
def sample_config(db_session, sample_user_id_string):
    """Create a sample email monitoring configuration."""
    config = EmailMonitoringConfig(
        id=uuid.uuid4(),
        user_id=uuid.UUID(sample_user_id_string),  # Store as UUID object
        email_provider="gmail",
        email_address="test@example.com",
        monitoring_enabled=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db_session.add(config)
    db_session.commit()
    db_session.refresh(config)
    return config


def test_bug_scenario_string_uuid_causes_error(db_session, sample_user_id_string, sample_config):
    """
    Test the original bug: Using string UUID directly in query causes AttributeError.
    
    This test demonstrates the problem that was occurring.
    """
    # This is what was happening before the fix
    user_id = sample_user_id_string  # String, not UUID object
    
    # On SQLite with as_uuid=True, this raises AttributeError
    with pytest.raises(Exception) as exc_info:
        configs = db_session.query(EmailMonitoringConfig).filter(
            EmailMonitoringConfig.user_id == user_id
        ).order_by(EmailMonitoringConfig.created_at.desc()).all()
    
    # The error should be related to UUID/attribute error
    assert "AttributeError" in str(type(exc_info.value)) or "StatementError" in str(type(exc_info.value))


def test_fix_convert_string_to_uuid_before_query(db_session, sample_user_id_string, sample_config):
    """
    Test the fix: Converting string to UUID object before query works correctly.
    
    This demonstrates the solution.
    """
    # Get user ID as string (simulating get_user_id_from_token)
    user_id = sample_user_id_string
    
    # THE FIX: Convert to UUID object using ensure_uuid
    user_id = ensure_uuid(user_id)
    
    # Now the query should work without errors
    configs = db_session.query(EmailMonitoringConfig).filter(
        EmailMonitoringConfig.user_id == user_id
    ).order_by(EmailMonitoringConfig.created_at.desc()).all()
    
    assert len(configs) == 1
    assert configs[0].email_address == "test@example.com"
    assert configs[0].user_id == uuid.UUID(sample_user_id_string)


def test_get_user_id_from_token_returns_string(db_session):
    """Test that get_user_id_from_token returns a string (not a UUID object)."""
    user_id = get_user_id_from_token(db_session)
    
    assert isinstance(user_id, str)
    assert user_id == "00000000-0000-0000-0000-000000000001"


def test_ensure_uuid_converts_string_to_uuid():
    """Test that ensure_uuid properly converts string to UUID object."""
    user_id_string = "00000000-0000-0000-0000-000000000001"
    
    user_id_uuid = ensure_uuid(user_id_string)
    
    assert isinstance(user_id_uuid, uuid.UUID)
    assert hasattr(user_id_uuid, 'hex')
    assert user_id_uuid.hex == "00000000000000000000000000000001"


def test_ensure_uuid_handles_uuid_object():
    """Test that ensure_uuid handles UUID objects correctly."""
    user_id_uuid = uuid.UUID("00000000-0000-0000-0000-000000000001")
    
    result = ensure_uuid(user_id_uuid)
    
    assert result is user_id_uuid  # Should return the same object
    assert isinstance(result, uuid.UUID)


def test_ensure_uuid_handles_none():
    """Test that ensure_uuid handles None correctly."""
    result = ensure_uuid(None)
    
    assert result is None


async def test_get_email_configs_integration(db_session, sample_config):
    """
    Integration test: Verify get_email_configs endpoint works with the fix.
    
    This simulates the actual API call that was failing.
    """
    from unittest.mock import patch
    
    # Mock the get_db dependency to return our test session
    with patch("api.routes.email_monitoring.get_db", return_value=db_session):
        from api.routes.email_monitoring import get_email_configs
        
        # Call the endpoint (which internally uses get_user_id_from_token)
        # This would have failed before the fix
        result = await get_email_configs(db=db_session)
        
        # Verify the result
        assert isinstance(result, list)
        assert len(result) == 1
        assert result[0].email_address == "test@example.com"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
