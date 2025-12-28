"""Tests for email monitoring UUID fix."""
import uuid
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from api.models.email_monitoring_config import Base, EmailMonitoringConfig


@pytest.fixture
def db_session():
    """Create an in-memory SQLite database for testing."""
    # Use SQLite for testing
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    
    yield session
    
    session.close()


@pytest.fixture
def sample_user_id():
    """Return a sample UUID for testing."""
    return uuid.UUID("00000000-0000-0000-0000-000000000001")


@pytest.fixture
def sample_config(db_session, sample_user_id):
    """Create a sample email monitoring configuration."""
    config = EmailMonitoringConfig(
        id=uuid.uuid4(),
        user_id=sample_user_id,
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


def test_uuid_query_with_uuid_object(db_session, sample_user_id, sample_config):
    """Test that querying with a UUID object works correctly."""
    # Query using UUID object (this should work)
    result = db_session.query(EmailMonitoringConfig).filter(
        EmailMonitoringConfig.user_id == sample_user_id
    ).first()
    
    assert result is not None
    assert result.id == sample_config.id
    assert result.user_id == sample_user_id


def test_uuid_query_with_string_fails_on_sqlite(db_session, sample_user_id, sample_config):
    """
    Test that querying with a string UUID fails on SQLite.
    
    This demonstrates the original bug where string UUIDs cause AttributeError.
    """
    # Convert UUID to string (this is what was causing the bug)
    user_id_string = str(sample_user_id)
    
    # On SQLite, this will fail with AttributeError
    # because SQLAlchemy UUID processor expects a UUID object
    with pytest.raises(Exception):  # Could be AttributeError or StatementError
        db_session.query(EmailMonitoringConfig).filter(
            EmailMonitoringConfig.user_id == user_id_string
        ).first()


def test_uuid_conversion_fix(db_session, sample_user_id, sample_config):
    """Test that converting string UUID to UUID object fixes the issue."""
    # Start with a string UUID (simulating what might come from request)
    user_id_string = str(sample_user_id)
    
    # Convert to UUID object (this is the fix)
    if isinstance(user_id_string, str):
        user_id_uuid = uuid.UUID(user_id_string)
    else:
        user_id_uuid = user_id_string
    
    # Now query should work
    result = db_session.query(EmailMonitoringConfig).filter(
        EmailMonitoringConfig.user_id == user_id_uuid
    ).first()
    
    assert result is not None
    assert result.id == sample_config.id


@patch("api.routes.email_monitoring.get_current_user_id")
@patch("api.routes.email_monitoring.get_db")
async def test_trigger_sync_with_string_user_id(mock_get_db, mock_get_user_id, db_session, sample_user_id, sample_config):
    """Test trigger_sync handles string user IDs correctly."""
    from api.routes.email_monitoring import trigger_sync, SyncRequest
    from fastapi import Request
    
    # Mock the user ID to return a string (simulating the bug scenario)
    mock_get_user_id.return_value = str(sample_user_id)
    mock_get_db.return_value = db_session
    
    # Create mock request
    mock_request = MagicMock(spec=Request)
    
    # Create sync request
    sync_request = SyncRequest(config_id=None)
    
    # This should NOT raise AttributeError anymore because we convert to UUID
    response = await trigger_sync(mock_request, sync_request, db_session)
    
    assert response.configs_count == 1
    assert response.job_id is not None


@patch("api.routes.email_monitoring.get_current_user_id")
@patch("api.routes.email_monitoring.get_db")
async def test_trigger_sync_with_uuid_object(mock_get_db, mock_get_user_id, db_session, sample_user_id, sample_config):
    """Test trigger_sync works correctly with UUID objects."""
    from api.routes.email_monitoring import trigger_sync, SyncRequest
    from fastapi import Request
    
    # Mock the user ID to return a UUID object
    mock_get_user_id.return_value = sample_user_id
    mock_get_db.return_value = db_session
    
    # Create mock request
    mock_request = MagicMock(spec=Request)
    
    # Create sync request
    sync_request = SyncRequest(config_id=None)
    
    # This should work fine
    response = await trigger_sync(mock_request, sync_request, db_session)
    
    assert response.configs_count == 1
    assert response.job_id is not None


@patch("api.routes.email_monitoring.get_current_user_id")
@patch("api.routes.email_monitoring.get_db")
async def test_trigger_sync_with_specific_config(mock_get_db, mock_get_user_id, db_session, sample_user_id, sample_config):
    """Test trigger_sync with specific config_id."""
    from api.routes.email_monitoring import trigger_sync, SyncRequest
    from fastapi import Request
    
    # Mock returns
    mock_get_user_id.return_value = sample_user_id
    mock_get_db.return_value = db_session
    
    # Create mock request
    mock_request = MagicMock(spec=Request)
    
    # Create sync request with specific config_id
    sync_request = SyncRequest(config_id=sample_config.id)
    
    # This should work
    response = await trigger_sync(mock_request, sync_request, db_session)
    
    assert response.configs_count == 1


@patch("api.routes.email_monitoring.get_current_user_id")
@patch("api.routes.email_monitoring.get_db")
async def test_trigger_sync_no_configs_found(mock_get_db, mock_get_user_id, db_session):
    """Test trigger_sync raises 404 when no configs found."""
    from api.routes.email_monitoring import trigger_sync, SyncRequest
    from fastapi import Request
    
    # Use a different user ID with no configs
    different_user_id = uuid.UUID("00000000-0000-0000-0000-000000000002")
    mock_get_user_id.return_value = different_user_id
    mock_get_db.return_value = db_session
    
    # Create mock request
    mock_request = MagicMock(spec=Request)
    
    # Create sync request
    sync_request = SyncRequest(config_id=None)
    
    # Should raise 404
    with pytest.raises(HTTPException) as exc_info:
        await trigger_sync(mock_request, sync_request, db_session)
    
    assert exc_info.value.status_code == 404


def test_email_monitoring_config_repr(sample_config):
    """Test EmailMonitoringConfig string representation."""
    repr_str = repr(sample_config)
    assert "EmailMonitoringConfig" in repr_str
    assert str(sample_config.id) in repr_str
    assert str(sample_config.user_id) in repr_str


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
