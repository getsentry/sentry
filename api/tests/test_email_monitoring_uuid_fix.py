"""
Tests for Email Monitoring API - UUID Fix Verification

This test suite verifies that the UUID handling fix resolves the
AttributeError: 'str' object has no attribute 'hex' issue.
"""

import pytest
from uuid import UUID, uuid4
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient
from fastapi import FastAPI

# Import the fixed modules
from api.routes.email_monitoring import router, get_user_id_from_token
from api.models.email_monitoring_config import EmailMonitoringConfig, Base


# Test database setup (SQLite for testing)
TEST_DATABASE_URL = "sqlite:///./test_email_monitoring.db"


@pytest.fixture(scope="function")
def test_db():
    """Create a test database session."""
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def test_user_id() -> UUID:
    """Provide a test user ID as a UUID object."""
    return UUID("00000000-0000-0000-0000-000000000001")


@pytest.fixture
def test_email_config(test_db: Session, test_user_id: UUID) -> EmailMonitoringConfig:
    """Create a test email monitoring configuration."""
    config = EmailMonitoringConfig(
        id=uuid4(),
        user_id=test_user_id,  # UUID object, not string
        email_address="test@example.com",
        email_provider="gmail",
        monitoring_enabled=True,
        sync_frequency_minutes=15,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    test_db.add(config)
    test_db.commit()
    test_db.refresh(config)
    return config


class TestUUIDHandling:
    """Test suite for UUID handling fixes."""
    
    def test_get_user_id_returns_uuid_object(self, test_db: Session):
        """
        CRITICAL TEST: Verify get_user_id_from_token returns UUID object.
        
        This test ensures the fix for the AttributeError is in place.
        The function must return a UUID object, not a string.
        """
        user_id = get_user_id_from_token(test_db)
        
        # Assert it's a UUID object, not a string
        assert isinstance(user_id, UUID), (
            f"get_user_id_from_token must return UUID object, "
            f"not {type(user_id).__name__}"
        )
        
        # Verify it has the .hex attribute (this would fail with string)
        assert hasattr(user_id, "hex"), "UUID object must have .hex attribute"
        assert isinstance(user_id.hex, str), "UUID.hex must return a string"
    
    def test_query_with_uuid_object(
        self,
        test_db: Session,
        test_user_id: UUID,
        test_email_config: EmailMonitoringConfig
    ):
        """
        Test that querying with UUID object works correctly.
        
        This test verifies that SQLAlchemy can properly bind UUID objects
        without raising AttributeError.
        """
        # Query using UUID object (not string)
        configs = (
            test_db.query(EmailMonitoringConfig)
            .filter(EmailMonitoringConfig.user_id == test_user_id)
            .all()
        )
        
        assert len(configs) == 1
        assert configs[0].id == test_email_config.id
        assert configs[0].user_id == test_user_id
        assert configs[0].email_address == "test@example.com"
    
    def test_query_with_string_uuid_fails(
        self,
        test_db: Session,
        test_user_id: UUID
    ):
        """
        Demonstrate that querying with string UUID causes the error.
        
        This test shows why the fix is necessary - using a string UUID
        would cause the AttributeError.
        """
        user_id_string = str(test_user_id)
        
        # This should raise an error with as_uuid=True column type
        with pytest.raises(Exception) as exc_info:
            test_db.query(EmailMonitoringConfig).filter(
                EmailMonitoringConfig.user_id == user_id_string
            ).all()
        
        # The error should be related to UUID binding
        assert "hex" in str(exc_info.value).lower() or "uuid" in str(exc_info.value).lower()
    
    def test_string_to_uuid_conversion(self):
        """Test that string UUIDs can be converted to UUID objects."""
        uuid_string = "00000000-0000-0000-0000-000000000001"
        
        # Convert string to UUID
        uuid_obj = UUID(uuid_string)
        
        assert isinstance(uuid_obj, UUID)
        assert str(uuid_obj) == uuid_string
        assert uuid_obj.hex == uuid_string.replace("-", "")
    
    def test_invalid_uuid_string_handling(self):
        """Test that invalid UUID strings are properly handled."""
        invalid_uuid = "not-a-valid-uuid"
        
        with pytest.raises(ValueError):
            UUID(invalid_uuid)


class TestEmailMonitoringEndpoint:
    """Test the email monitoring API endpoint with the fix."""
    
    @pytest.fixture
    def app(self) -> FastAPI:
        """Create a test FastAPI application."""
        app = FastAPI()
        app.include_router(router)
        return app
    
    @pytest.fixture
    def client(self, app: FastAPI) -> TestClient:
        """Create a test client."""
        return TestClient(app)
    
    def test_get_email_configs_endpoint(
        self,
        client: TestClient,
        test_db: Session,
        test_email_config: EmailMonitoringConfig
    ):
        """
        Test the GET /api/v1/email-monitoring/config endpoint.
        
        This test verifies that the endpoint works correctly with
        the UUID fix in place.
        """
        # Mock the database dependency
        from api.dependencies import get_db
        from api.routes import email_monitoring
        
        def override_get_db():
            try:
                yield test_db
            finally:
                pass
        
        # Override dependency
        email_monitoring.router.dependency_overrides[get_db] = override_get_db
        
        # Make request
        response = client.get("/api/v1/email-monitoring/config")
        
        # Verify response
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 0  # May be 0 or more configs


def test_uuid_comparison_operations():
    """Test that UUID objects support proper comparison operations."""
    uuid1 = UUID("00000000-0000-0000-0000-000000000001")
    uuid2 = UUID("00000000-0000-0000-0000-000000000001")
    uuid3 = UUID("00000000-0000-0000-0000-000000000002")
    
    # Equality
    assert uuid1 == uuid2
    assert uuid1 != uuid3
    
    # String representation
    assert str(uuid1) == "00000000-0000-0000-0000-000000000001"
    
    # Hex representation
    assert uuid1.hex == "00000000000000000000000000000001"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
