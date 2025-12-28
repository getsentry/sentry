"""Tests for UUID handling in email monitoring API.

This test module verifies that the UUID fix properly handles string UUIDs
and converts them to UUID objects before using them in SQLAlchemy queries,
preventing the AttributeError: 'str' object has no attribute 'hex'.
"""
import uuid
from datetime import datetime
from unittest.mock import Mock, patch

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from api.models.email_monitoring_config import Base, EmailMonitoringConfig
from api.models.monitored_email import MonitoredEmail
from api.models.email_status_update import EmailStatusUpdate
from api.routes.email_monitoring import get_monitoring_stats
from api.utils import ensure_uuid


@pytest.fixture
def db_session():
    """Create an in-memory SQLite database for testing."""
    # Use SQLite for testing (simpler than PostgreSQL)
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    
    yield session
    
    session.close()


@pytest.fixture
def test_user_id():
    """Generate a test user ID as a UUID object."""
    return uuid.UUID("00000000-0000-0000-0000-000000000001")


@pytest.fixture
def test_user_id_str(test_user_id):
    """Generate a test user ID as a string."""
    return str(test_user_id)


@pytest.fixture
def mock_request(test_user_id_str):
    """Create a mock request that returns user_id as a string."""
    request = Mock()
    request.user_id = test_user_id_str
    return request


@pytest.fixture
def setup_test_data(db_session, test_user_id):
    """Set up test data in the database."""
    # Create email monitoring config
    config = EmailMonitoringConfig(
        id=uuid.uuid4(),
        user_id=test_user_id,
        email_provider="gmail",
        email_address="test@example.com",
        monitoring_enabled=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db_session.add(config)
    db_session.flush()
    
    # Create monitored emails
    email1 = MonitoredEmail(
        id=uuid.uuid4(),
        config_id=config.id,
        message_id="msg1",
        subject="ATS Email 1",
        sender="ats@company.com",
        is_ats_email=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    email2 = MonitoredEmail(
        id=uuid.uuid4(),
        config_id=config.id,
        message_id="msg2",
        subject="Regular Email",
        sender="person@company.com",
        is_ats_email=False,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db_session.add(email1)
    db_session.add(email2)
    db_session.flush()
    
    # Create status updates
    update1 = EmailStatusUpdate(
        id=uuid.uuid4(),
        email_id=email1.id,
        company_name="Test Company",
        job_title="Software Engineer",
        status="Interview Scheduled",
        auto_applied=True,
        requires_review=False,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    update2 = EmailStatusUpdate(
        id=uuid.uuid4(),
        email_id=email1.id,
        company_name="Test Company 2",
        job_title="Senior Engineer",
        status="Application Received",
        auto_applied=False,
        requires_review=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db_session.add(update1)
    db_session.add(update2)
    db_session.commit()
    
    return {
        "config": config,
        "emails": [email1, email2],
        "updates": [update1, update2]
    }


def test_ensure_uuid_converts_string_to_uuid():
    """Test that ensure_uuid converts string to UUID object."""
    uuid_str = "00000000-0000-0000-0000-000000000001"
    result = ensure_uuid(uuid_str)
    
    assert isinstance(result, uuid.UUID)
    assert str(result) == uuid_str


def test_ensure_uuid_preserves_uuid_object():
    """Test that ensure_uuid preserves UUID objects."""
    uuid_obj = uuid.UUID("00000000-0000-0000-0000-000000000001")
    result = ensure_uuid(uuid_obj)
    
    assert isinstance(result, uuid.UUID)
    assert result == uuid_obj


def test_ensure_uuid_handles_none():
    """Test that ensure_uuid handles None correctly."""
    result = ensure_uuid(None)
    assert result is None


def test_ensure_uuid_raises_on_invalid_string():
    """Test that ensure_uuid raises ValueError on invalid UUID string."""
    with pytest.raises(ValueError, match="Invalid UUID string"):
        ensure_uuid("not-a-uuid")


@patch("api.routes.email_monitoring.get_current_user_id")
def test_get_monitoring_stats_with_string_user_id(
    mock_get_user_id,
    db_session,
    mock_request,
    test_user_id_str,
    test_user_id,
    setup_test_data
):
    """
    Test that get_monitoring_stats works when user_id is returned as a string.
    
    This is the critical test that verifies the fix for:
    AttributeError: 'str' object has no attribute 'hex'
    """
    # Mock get_current_user_id to return a STRING (the problematic scenario)
    mock_get_user_id.return_value = test_user_id_str
    
    # This should NOT raise AttributeError because we call ensure_uuid()
    result = get_monitoring_stats(mock_request, db_session)
    
    # Verify the stats are correct
    assert result.total_emails == 2
    assert result.ats_emails == 1
    assert result.total_updates == 2
    assert result.auto_applied == 1
    assert result.pending_review == 1


@patch("api.routes.email_monitoring.get_current_user_id")
def test_get_monitoring_stats_with_uuid_object(
    mock_get_user_id,
    db_session,
    mock_request,
    test_user_id,
    setup_test_data
):
    """
    Test that get_monitoring_stats works when user_id is returned as a UUID object.
    """
    # Mock get_current_user_id to return a UUID object (the correct scenario)
    mock_get_user_id.return_value = test_user_id
    
    # This should work fine
    result = get_monitoring_stats(mock_request, db_session)
    
    # Verify the stats are correct
    assert result.total_emails == 2
    assert result.ats_emails == 1
    assert result.total_updates == 2
    assert result.auto_applied == 1
    assert result.pending_review == 1


@patch("api.routes.email_monitoring.get_current_user_id")
def test_get_monitoring_stats_empty_results(
    mock_get_user_id,
    db_session,
    mock_request
):
    """Test that get_monitoring_stats returns zeros when no data exists."""
    # Use a different user ID that has no data
    different_user_id = uuid.UUID("99999999-9999-9999-9999-999999999999")
    mock_get_user_id.return_value = str(different_user_id)
    
    result = get_monitoring_stats(mock_request, db_session)
    
    # All stats should be zero
    assert result.total_emails == 0
    assert result.ats_emails == 0
    assert result.total_updates == 0
    assert result.auto_applied == 0
    assert result.pending_review == 0


def test_sqlalchemy_uuid_column_requires_uuid_object(db_session, test_user_id_str):
    """
    Test that demonstrates the original problem: passing a string to a UUID column.
    
    This test would fail if we didn't use ensure_uuid() in our queries.
    """
    # Create a config
    config = EmailMonitoringConfig(
        id=uuid.uuid4(),
        user_id=uuid.UUID(test_user_id_str),  # Properly convert to UUID
        email_provider="gmail",
        email_address="test@example.com",
        monitoring_enabled=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db_session.add(config)
    db_session.commit()
    
    # This query should work when we use ensure_uuid
    user_id_for_query = ensure_uuid(test_user_id_str)
    result = db_session.query(EmailMonitoringConfig).filter(
        EmailMonitoringConfig.user_id == user_id_for_query
    ).first()
    
    assert result is not None
    assert result.email_address == "test@example.com"


def test_uuid_hex_attribute():
    """Test that UUID objects have the hex attribute."""
    uuid_obj = uuid.UUID("00000000-0000-0000-0000-000000000001")
    
    # UUID objects have .hex attribute
    assert hasattr(uuid_obj, "hex")
    assert uuid_obj.hex == "00000000000000000000000000000001"
    
    # Strings do NOT have .hex attribute (this is the root cause of the bug)
    uuid_str = str(uuid_obj)
    assert not hasattr(uuid_str, "hex")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
