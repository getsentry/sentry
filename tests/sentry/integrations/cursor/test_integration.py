from __future__ import annotations

from collections.abc import Mapping
from typing import Any, cast
from unittest.mock import MagicMock, patch
from uuid import UUID

import pytest

from sentry.integrations.cursor.integration import (
    CursorAgentIntegration,
    CursorAgentIntegrationProvider,
)
from sentry.integrations.cursor.models import CursorApiKeyMetadata
from sentry.shared_integrations.exceptions import ApiError, IntegrationConfigurationError
from sentry.testutils.cases import IntegrationTestCase
from sentry.testutils.silo import assume_test_silo_mode_of


@pytest.fixture
def provider():
    return CursorAgentIntegrationProvider()


def test_build_integration_stores_metadata(provider):
    fake_uuid = UUID("11111111-2222-3333-4444-555555555555")
    with (
        patch("sentry.integrations.cursor.integration.uuid.uuid4", return_value=fake_uuid),
        patch("sentry.integrations.cursor.integration.generate_token", return_value="hook-secret"),
        patch(
            "sentry.integrations.cursor.client.CursorAgentClient.get_api_key_metadata"
        ) as mock_get_metadata,
    ):
        mock_get_metadata.return_value = CursorApiKeyMetadata(
            apiKeyName="Test Key",
            createdAt="2024-01-15T10:30:00Z",
            userEmail="test@example.com",
        )
        integration_data = provider.build_integration(state={"config": {"api_key": "cursor-api"}})

    assert integration_data["external_id"] == fake_uuid.hex
    metadata = integration_data["metadata"]
    assert "api_key" in metadata
    assert "webhook_secret" in metadata
    assert metadata["domain_name"] == "cursor.sh"
    assert metadata["api_key"] == "cursor-api"
    assert metadata["webhook_secret"] == "hook-secret"


def test_build_integration_fetches_and_stores_api_key_metadata(provider):
    """Test that build_integration fetches metadata from /v0/me and stores it"""
    fake_uuid = UUID("22222222-3333-4444-5555-666666666666")
    mock_metadata = CursorApiKeyMetadata(
        apiKeyName="Production API Key",
        createdAt="2024-01-15T10:30:00Z",
        userEmail="developer@example.com",
    )

    with (
        patch("sentry.integrations.cursor.integration.uuid.uuid4", return_value=fake_uuid),
        patch("sentry.integrations.cursor.integration.generate_token", return_value="hook-secret"),
        patch(
            "sentry.integrations.cursor.client.CursorAgentClient.get_api_key_metadata"
        ) as mock_get_metadata,
    ):
        mock_get_metadata.return_value = mock_metadata
        integration_data = provider.build_integration(state={"config": {"api_key": "cursor-api"}})

    # Verify metadata was fetched
    mock_get_metadata.assert_called_once()

    # Verify metadata is stored
    metadata = integration_data["metadata"]
    assert metadata["api_key_name"] == "Production API Key"
    assert metadata["user_email"] == "developer@example.com"

    # Verify integration name includes API key name
    assert (
        integration_data["name"] == "Cursor Cloud Agent - developer@example.com/Production API Key"
    )


def test_build_integration_raises_on_api_error(provider):
    """Test that build_integration raises IntegrationConfigurationError on API failure"""
    fake_uuid = UUID("33333333-4444-5555-6666-777777777777")

    with (
        patch("sentry.integrations.cursor.integration.uuid.uuid4", return_value=fake_uuid),
        patch("sentry.integrations.cursor.integration.generate_token", return_value="hook-secret"),
        patch(
            "sentry.integrations.cursor.client.CursorAgentClient.get_api_key_metadata"
        ) as mock_get_metadata,
    ):
        mock_get_metadata.side_effect = ApiError("API Error", 500)
        with pytest.raises(
            IntegrationConfigurationError,
            match="Unable to validate Cursor API key",
        ):
            provider.build_integration(state={"config": {"api_key": "cursor-api"}})


def test_build_integration_raises_on_invalid_api_key(provider):
    """Test that build_integration raises IntegrationConfigurationError with 401/403 status"""
    fake_uuid = UUID("44444444-5555-6666-7777-888888888888")

    with (
        patch("sentry.integrations.cursor.integration.uuid.uuid4", return_value=fake_uuid),
        patch("sentry.integrations.cursor.integration.generate_token", return_value="hook-secret"),
        patch(
            "sentry.integrations.cursor.client.CursorAgentClient.get_api_key_metadata"
        ) as mock_get_metadata,
    ):
        mock_get_metadata.side_effect = ApiError("Unauthorized", 401)
        with pytest.raises(
            IntegrationConfigurationError,
            match="Invalid Cursor API key",
        ):
            provider.build_integration(state={"config": {"api_key": "invalid-api-key"}})


def test_build_integration_raises_on_validation_error(provider):
    """Test that build_integration raises IntegrationConfigurationError on ValidationError"""
    fake_uuid = UUID("55555555-6666-7777-8888-999999999999")

    with (
        patch("sentry.integrations.cursor.integration.uuid.uuid4", return_value=fake_uuid),
        patch("sentry.integrations.cursor.integration.generate_token", return_value="hook-secret"),
        patch(
            "sentry.integrations.cursor.client.CursorAgentClient.get_api_key_metadata"
        ) as mock_get_metadata,
    ):
        try:
            CursorApiKeyMetadata.parse_obj({})
        except Exception as e:
            validation_error = e

        mock_get_metadata.side_effect = validation_error
        with pytest.raises(
            IntegrationConfigurationError,
            match="Received unexpected response from Cursor API",
        ):
            provider.build_integration(state={"config": {"api_key": "cursor-api"}})


def test_build_integration_stores_api_key_and_webhook_secret(provider):
    """Test that build_integration stores both API key and webhook secret"""
    with patch(
        "sentry.integrations.cursor.client.CursorAgentClient.get_api_key_metadata"
    ) as mock_get_metadata:
        mock_get_metadata.return_value = CursorApiKeyMetadata(
            apiKeyName="Test Key",
            createdAt="2024-01-15T10:30:00Z",
            userEmail="test@example.com",
        )
        integration_data = provider.build_integration(state={"config": {"api_key": "new-api"}})

    metadata_arg = integration_data["metadata"]

    assert metadata_arg["api_key"] == "new-api"
    assert isinstance(metadata_arg["webhook_secret"], str)

    assert metadata_arg["webhook_secret"]
    assert len(metadata_arg["webhook_secret"]) > 0


class CursorIntegrationTest(IntegrationTestCase):
    provider = CursorAgentIntegrationProvider

    def test_build_integration(self):
        state: Mapping[str, Any] = {"config": {"api_key": "test_api_key_123"}}
        fake_uuid = UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")

        with (
            patch("sentry.integrations.cursor.integration.uuid.uuid4", return_value=fake_uuid),
            patch(
                "sentry.integrations.cursor.integration.generate_token", return_value="secret123"
            ),
            patch(
                "sentry.integrations.cursor.client.CursorAgentClient.get_api_key_metadata"
            ) as mock_get_metadata,
        ):
            mock_get_metadata.return_value = CursorApiKeyMetadata(
                apiKeyName="Test Key",
                createdAt="2024-01-15T10:30:00Z",
                userEmail="test@example.com",
            )
            integration_dict = self.provider().build_integration(state)

        assert integration_dict["external_id"] == fake_uuid.hex
        metadata = integration_dict["metadata"]
        assert metadata["domain_name"] == "cursor.sh"
        assert "api_key" in metadata
        assert "webhook_secret" in metadata
        assert metadata["api_key"] == "test_api_key_123"
        assert metadata["webhook_secret"] == "secret123"

    def test_build_integration_missing_config(self):
        """Test that build_integration raises error when config is missing"""
        state: Mapping[str, Any] = {}

        with pytest.raises(IntegrationConfigurationError, match="Missing configuration data"):
            self.provider().build_integration(state)

    def test_build_integration_empty_config(self):
        """Test that build_integration raises error when config is empty"""
        state: Mapping[str, Any] = {"config": {}}

        with pytest.raises(IntegrationConfigurationError, match="Missing configuration data"):
            self.provider().build_integration(state)

    def test_get_client(self):
        metadata = {
            "api_key": "test_api_key_123",
            "webhook_secret": "test_secret_123",
            "domain_name": "cursor.sh",
        }

        integration = self.create_provider_integration(
            provider="cursor",
            name="Cursor Agent",
            external_id="cursor",
            metadata=metadata,
        )

        installation = integration.get_installation(organization_id=self.organization.id)

        client = installation.get_client()
        assert client.api_key == "test_api_key_123"
        assert client.base_url == "https://api.cursor.com"

    @patch("sentry.integrations.cursor.client.CursorAgentClient.post")
    def test_launch(self, mock_post):
        from datetime import datetime

        from sentry.integrations.coding_agent.models import CodingAgentLaunchRequest
        from sentry.seer.autofix.utils import CodingAgentProviderType, CodingAgentStatus
        from sentry.seer.models import SeerRepoDefinition

        mock_response = MagicMock()
        mock_response.json = {
            "id": "test_session_123",
            "name": "Test Session",
            "status": "running",
            "createdAt": datetime.now().isoformat(),
            "source": {
                "repository": "https://github.com/testorg/testrepo",
                "ref": "main",
            },
            "target": {
                "url": "https://github.com/org/repo/pull/1",
                "autoCreatePr": True,
                "branchName": "fix-bug",
            },
        }
        mock_post.return_value = mock_response

        metadata = {
            "api_key": "test_api_key_123",
            "webhook_secret": "test_secret_123",
            "domain_name": "cursor.sh",
        }

        integration = self.create_provider_integration(
            provider="cursor",
            name="Cursor Agent",
            external_id="cursor",
            metadata=metadata,
        )

        installation = integration.get_installation(organization_id=self.organization.id)

        request = CodingAgentLaunchRequest(
            prompt="Fix the bug",
            repository=SeerRepoDefinition(
                integration_id="123",
                provider="github",
                owner="testorg",
                name="testrepo",
                external_id="456",
                branch_name="main",
            ),
            branch_name="fix-bug",
        )

        result = cast(CursorAgentIntegration, installation).launch(request=request)

        assert result.id == "test_session_123"
        assert result.status == CodingAgentStatus.RUNNING
        assert result.provider == CodingAgentProviderType.CURSOR_BACKGROUND_AGENT
        assert result.name == "Test Session"

        mock_post.assert_called_once()
        call_args = mock_post.call_args
        assert call_args[0][0] == "/v0/agents"

    @patch("sentry.integrations.cursor.client.CursorAgentClient.get_api_key_metadata")
    def test_update_organization_config_persists_api_key_and_clears_org_config(
        self, mock_get_metadata
    ):
        mock_get_metadata.return_value = CursorApiKeyMetadata(
            apiKeyName="New Key",
            createdAt="2024-01-15T10:30:00Z",
            userEmail="new@example.com",
        )

        integration = self.create_integration(
            organization=self.organization,
            provider="cursor",
            name="Cursor Agent",
            external_id="cursor",
            metadata={
                "api_key": "old_key",
                "webhook_secret": "secret123",
                "domain_name": "cursor.sh",
            },
        )

        installation = integration.get_installation(organization_id=self.organization.id)

        installation.update_organization_config({"api_key": "new_secret_key"})

        mock_get_metadata.assert_called_once()

        integration.refresh_from_db()
        assert integration.metadata["api_key"] == "new_secret_key"
        assert integration.metadata["webhook_secret"] == "secret123"
        assert integration.metadata["api_key_name"] == "New Key"
        assert integration.metadata["user_email"] == "new@example.com"
        assert integration.name == "Cursor Cloud Agent - new@example.com/New Key"

        from sentry.integrations.models.organization_integration import OrganizationIntegration

        with assume_test_silo_mode_of(OrganizationIntegration):
            org_integration = OrganizationIntegration.objects.get(
                integration_id=integration.id, organization_id=self.organization.id
            )
            assert org_integration.config == {}

    def test_update_organization_config_missing_api_key_raises(self):
        integration = self.create_integration(
            organization=self.organization,
            provider="cursor",
            name="Cursor Agent",
            external_id="cursor",
            metadata={
                "api_key": "present_key",
                "webhook_secret": "secret123",
                "domain_name": "cursor.sh",
            },
        )

        installation = integration.get_installation(organization_id=self.organization.id)

        with pytest.raises(IntegrationConfigurationError, match="API key is required"):
            installation.update_organization_config({})

    @patch("sentry.integrations.cursor.client.CursorAgentClient.get_api_key_metadata")
    def test_update_organization_config_raises_on_invalid_key(self, mock_get_metadata):
        mock_get_metadata.side_effect = ApiError("Unauthorized", 401)

        integration = self.create_integration(
            organization=self.organization,
            provider="cursor",
            name="Cursor Agent",
            external_id="cursor",
            metadata={
                "api_key": "old_key",
                "webhook_secret": "secret123",
                "domain_name": "cursor.sh",
            },
        )

        installation = integration.get_installation(organization_id=self.organization.id)

        with pytest.raises(IntegrationConfigurationError, match="Invalid Cursor API key"):
            installation.update_organization_config({"api_key": "invalid_key"})

        integration.refresh_from_db()
        assert integration.metadata["api_key"] == "old_key"

    @patch("sentry.integrations.cursor.client.CursorAgentClient.get_api_key_metadata")
    def test_update_organization_config_raises_on_api_error(self, mock_get_metadata):
        mock_get_metadata.side_effect = ApiError("API Error", 500)

        integration = self.create_integration(
            organization=self.organization,
            provider="cursor",
            name="Cursor Agent",
            external_id="cursor",
            metadata={
                "api_key": "old_key",
                "webhook_secret": "secret123",
                "domain_name": "cursor.sh",
            },
        )

        installation = integration.get_installation(organization_id=self.organization.id)

        with pytest.raises(
            IntegrationConfigurationError, match="Unable to validate Cursor API key"
        ):
            installation.update_organization_config({"api_key": "new_key"})

        integration.refresh_from_db()
        assert integration.metadata["api_key"] == "old_key"

    def test_property_getters(self):
        """Test that api_key and webhook_secret property getters return correct values"""
        integration = self.create_integration(
            organization=self.organization,
            provider="cursor",
            name="Cursor Agent",
            external_id="cursor",
            metadata={
                "api_key": "test_api_key_value",
                "webhook_secret": "test_webhook_secret_value",
                "domain_name": "cursor.sh",
            },
        )

        installation = cast(
            CursorAgentIntegration,
            integration.get_installation(organization_id=self.organization.id),
        )

        assert installation.api_key == "test_api_key_value"
        assert installation.webhook_secret == "test_webhook_secret_value"

    @patch("sentry.integrations.cursor.client.CursorAgentClient.get_api_key_metadata")
    def test_build_integration_creates_unique_installations(self, mock_get_metadata):
        """Test that each call to build_integration creates a unique integration"""
        mock_get_metadata.return_value = CursorApiKeyMetadata(
            apiKeyName="Test Key",
            createdAt="2024-01-15T10:30:00Z",
            userEmail="test@example.com",
        )

        state: Mapping[str, Any] = {"config": {"api_key": "test_api_key_123"}}

        integration_dict_1 = self.provider().build_integration(state)
        integration_dict_2 = self.provider().build_integration(state)
        integration_dict_3 = self.provider().build_integration(state)

        external_ids = {
            integration_dict_1["external_id"],
            integration_dict_2["external_id"],
            integration_dict_3["external_id"],
        }
        assert (
            len(external_ids) == 3
        ), "Each build_integration call should create a unique external_id"

        for integration_dict in [integration_dict_1, integration_dict_2, integration_dict_3]:
            assert "external_id" in integration_dict
            assert "metadata" in integration_dict
            assert integration_dict["metadata"]["domain_name"] == "cursor.sh"
            assert "api_key" in integration_dict["metadata"]
            assert "webhook_secret" in integration_dict["metadata"]

        webhook_secret_1 = integration_dict_1["metadata"]["webhook_secret"]
        webhook_secret_2 = integration_dict_2["metadata"]["webhook_secret"]
        webhook_secret_3 = integration_dict_3["metadata"]["webhook_secret"]

        webhook_secrets = {webhook_secret_1, webhook_secret_2, webhook_secret_3}
        assert len(webhook_secrets) == 3, "Each integration should have a unique webhook secret"

    def test_get_dynamic_display_information(self):
        """Test that get_dynamic_display_information returns metadata"""
        integration = self.create_integration(
            organization=self.organization,
            provider="cursor",
            name="Cursor Agent - Production Key",
            external_id="cursor",
            metadata={
                "api_key": "test_api_key",
                "webhook_secret": "test_secret",
                "domain_name": "cursor.sh",
                "api_key_name": "Production Key",
                "user_email": "dev@example.com",
            },
        )

        installation = cast(
            CursorAgentIntegration,
            integration.get_installation(organization_id=self.organization.id),
        )

        display_info = installation.get_dynamic_display_information()

        assert display_info is not None
        assert display_info["api_key_name"] == "Production Key"
        assert display_info["user_email"] == "dev@example.com"

    def test_get_dynamic_display_information_returns_none_when_no_metadata(self):
        """Test that get_dynamic_display_information returns None when metadata is missing"""
        integration = self.create_integration(
            organization=self.organization,
            provider="cursor",
            name="Cursor Agent",
            external_id="cursor",
            metadata={
                "api_key": "test_api_key",
                "webhook_secret": "test_secret",
                "domain_name": "cursor.sh",
            },
        )

        installation = cast(
            CursorAgentIntegration,
            integration.get_installation(organization_id=self.organization.id),
        )

        display_info = installation.get_dynamic_display_information()

        assert display_info is None
