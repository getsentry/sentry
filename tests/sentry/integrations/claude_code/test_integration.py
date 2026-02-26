"""
Tests for ClaudeCodeAgentIntegration and ClaudeCodeAgentIntegrationProvider.

Tests cover:
- Provider build_integration with API key validation
- Integration installation and client creation
- Configuration updates with API key validation
- Launch functionality with CodingAgentLaunchRequest
- Multiple unique installations
- Property getters and metadata storage
- Error scenarios (API errors, invalid keys, missing config)
- Environment ID support (optional at setup, updatable later)
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, cast
from unittest.mock import MagicMock, patch
from uuid import UUID

import pytest
import responses
from django.test import override_settings

from sentry.integrations.claude_code.integration import (
    PROVIDER_NAME,
    ClaudeCodeAgentIntegration,
    ClaudeCodeAgentIntegrationProvider,
)
from sentry.shared_integrations.exceptions import IntegrationConfigurationError
from sentry.testutils.cases import IntegrationTestCase

CLAUDE_CODE_CLIENT_CLASS = "getsentry.integrations.claude_code.client.ClaudeCodeClient"
CLAUDE_CODE_BASE_URL = "https://api.anthropic.com"


@pytest.fixture
def provider():
    return ClaudeCodeAgentIntegrationProvider()


@override_settings(CLAUDE_CODE_CLIENT_CLASS=CLAUDE_CODE_CLIENT_CLASS)
def test_build_integration_stores_metadata(provider):
    """Test that build_integration stores API key in metadata"""
    fake_uuid = UUID("11111111-2222-3333-4444-555555555555")
    with (
        patch("sentry.integrations.claude_code.integration.uuid.uuid4", return_value=fake_uuid),
        patch(
            "getsentry.integrations.claude_code.client.ClaudeCodeClient.validate_api_key"
        ) as mock_validate,
    ):
        mock_validate.return_value = True
        integration_data = provider.build_integration(state={"api_key": "sk-ant-api-key"})

    assert integration_data["external_id"] == fake_uuid.hex
    metadata = integration_data["metadata"]
    assert "api_key" in metadata
    assert metadata["domain_name"] == "anthropic.com"
    assert metadata["api_key"] == "sk-ant-api-key"
    assert metadata["environment_id"] is None


@override_settings(CLAUDE_CODE_CLIENT_CLASS=CLAUDE_CODE_CLIENT_CLASS)
def test_build_integration_with_environment_id(provider):
    """Test that build_integration stores environment_id when provided"""
    with patch(
        "getsentry.integrations.claude_code.client.ClaudeCodeClient.validate_api_key"
    ) as mock_validate:
        mock_validate.return_value = True
        integration_data = provider.build_integration(
            state={
                "api_key": "sk-ant-api-key",
                "environment": {"environment_id": "env-123"},
            }
        )

    metadata = integration_data["metadata"]
    assert metadata["api_key"] == "sk-ant-api-key"
    assert metadata["environment_id"] == "env-123"


@override_settings(CLAUDE_CODE_CLIENT_CLASS=CLAUDE_CODE_CLIENT_CLASS)
def test_build_integration_validates_api_key(provider):
    """Test that build_integration validates API key via Anthropic API"""
    fake_uuid = UUID("22222222-3333-4444-5555-666666666666")

    with (
        patch("sentry.integrations.claude_code.integration.uuid.uuid4", return_value=fake_uuid),
        patch(
            "getsentry.integrations.claude_code.client.ClaudeCodeClient.validate_api_key"
        ) as mock_validate,
    ):
        mock_validate.return_value = True
        integration_data = provider.build_integration(state={"api_key": "sk-ant-valid-key"})

    # Verify API key validation was called
    mock_validate.assert_called_once()

    # Verify integration data is correct
    assert integration_data["name"] == PROVIDER_NAME
    assert integration_data["metadata"]["api_key"] == "sk-ant-valid-key"


@override_settings(CLAUDE_CODE_CLIENT_CLASS=CLAUDE_CODE_CLIENT_CLASS)
def test_build_integration_raises_on_invalid_api_key(provider):
    """Test that build_integration raises IntegrationConfigurationError for invalid API key"""
    fake_uuid = UUID("33333333-4444-5555-6666-777777777777")

    with (
        patch("sentry.integrations.claude_code.integration.uuid.uuid4", return_value=fake_uuid),
        patch(
            "getsentry.integrations.claude_code.client.ClaudeCodeClient.validate_api_key"
        ) as mock_validate,
    ):
        mock_validate.return_value = False
        with pytest.raises(
            IntegrationConfigurationError,
            match="Invalid Anthropic API key",
        ):
            provider.build_integration(state={"api_key": "invalid-key"})


@override_settings(CLAUDE_CODE_CLIENT_CLASS=CLAUDE_CODE_CLIENT_CLASS)
def test_build_integration_raises_on_validation_exception(provider):
    """Test that build_integration raises IntegrationConfigurationError on validation exception"""
    fake_uuid = UUID("44444444-5555-6666-7777-888888888888")

    with (
        patch("sentry.integrations.claude_code.integration.uuid.uuid4", return_value=fake_uuid),
        patch(
            "getsentry.integrations.claude_code.client.ClaudeCodeClient.validate_api_key"
        ) as mock_validate,
    ):
        mock_validate.side_effect = Exception("Network error")
        with pytest.raises(
            IntegrationConfigurationError,
            match="Unable to validate Anthropic API key",
        ):
            provider.build_integration(state={"api_key": "sk-ant-key"})


@override_settings(CLAUDE_CODE_CLIENT_CLASS=CLAUDE_CODE_CLIENT_CLASS)
def test_build_integration_stores_api_key(provider):
    """Test that build_integration stores API key"""
    with patch(
        "getsentry.integrations.claude_code.client.ClaudeCodeClient.validate_api_key"
    ) as mock_validate:
        mock_validate.return_value = True
        integration_data = provider.build_integration(state={"api_key": "sk-ant-new-api"})

    metadata_arg = integration_data["metadata"]

    assert metadata_arg["api_key"] == "sk-ant-new-api"


@override_settings(CLAUDE_CODE_CLIENT_CLASS=CLAUDE_CODE_CLIENT_CLASS)
class ClaudeCodeIntegrationTest(IntegrationTestCase):
    provider = ClaudeCodeAgentIntegrationProvider

    def _make_metadata(self, **overrides):
        """Helper to create integration metadata with defaults."""
        defaults = {
            "api_key": "sk-ant-test-api-key-123",
            "domain_name": "anthropic.com",
        }
        defaults.update(overrides)
        return defaults

    def test_build_integration(self):
        """Test basic build_integration flow"""
        state: Mapping[str, Any] = {"api_key": "sk-ant-test-api-key-123"}
        fake_uuid = UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")

        with (
            patch("sentry.integrations.claude_code.integration.uuid.uuid4", return_value=fake_uuid),
            patch(
                "getsentry.integrations.claude_code.client.ClaudeCodeClient.validate_api_key"
            ) as mock_validate,
        ):
            mock_validate.return_value = True
            integration_dict = self.provider().build_integration(state)

        assert integration_dict["external_id"] == fake_uuid.hex
        assert integration_dict["name"] == PROVIDER_NAME
        metadata = integration_dict["metadata"]
        assert metadata["domain_name"] == "anthropic.com"
        assert metadata["api_key"] == "sk-ant-test-api-key-123"

    def test_build_integration_missing_api_key(self):
        """Test that build_integration raises error when API key is missing"""
        state: Mapping[str, Any] = {}

        with pytest.raises(IntegrationConfigurationError, match="Missing API key"):
            self.provider().build_integration(state)

    def test_get_client(self):
        """Test that get_client returns properly configured ClaudeCodeClient"""
        integration = self.create_provider_integration(
            provider="claude_code",
            name="Claude Code Agent",
            external_id="claude-code-ext-123",
            metadata=self._make_metadata(),
        )

        installation = integration.get_installation(organization_id=self.organization.id)

        client = installation.get_client()
        assert client.api_key == "sk-ant-test-api-key-123"
        assert client.environment_id is None
        assert client.base_url == CLAUDE_CODE_BASE_URL

    def test_get_client_with_environment_id(self):
        """Test that get_client passes environment_id when configured"""
        integration = self.create_provider_integration(
            provider="claude_code",
            name="Claude Code Agent",
            external_id="claude-code-ext-123",
            metadata=self._make_metadata(environment_id="env-456"),
        )

        installation = integration.get_installation(organization_id=self.organization.id)

        client = installation.get_client()
        assert client.api_key == "sk-ant-test-api-key-123"
        assert client.environment_id == "env-456"

    @responses.activate
    @patch("getsentry.integrations.claude_code.client.integration_service")
    def test_launch(self, mock_integration_service):
        """Test launch method creates session and returns CodingAgentState"""
        from datetime import datetime

        from sentry.integrations.coding_agent.models import CodingAgentLaunchRequest
        from sentry.integrations.github.client import GitHubBaseClient
        from sentry.seer.autofix.utils import CodingAgentProviderType, CodingAgentStatus
        from sentry.seer.models import SeerRepoDefinition

        # Mock GitHub integration for token retrieval
        mock_github_integration = MagicMock()
        mock_installation = MagicMock()
        mock_client = MagicMock(spec=GitHubBaseClient)
        mock_client.get_access_token.return_value = {"access_token": "ghp_test_token"}
        mock_installation.get_client.return_value = mock_client
        mock_github_integration.get_installation.return_value = mock_installation
        mock_integration_service.get_integration.return_value = mock_github_integration

        env_id = "env-123"
        session_id = "session-456"

        # Mock API responses
        responses.add(
            responses.GET,
            f"{CLAUDE_CODE_BASE_URL}/v1/environments",
            json={"data": [{"id": env_id, "name": "sentry-autofix-agents"}]},
            status=200,
        )

        responses.add(
            responses.POST,
            f"{CLAUDE_CODE_BASE_URL}/v1/sessions",
            json={"id": session_id, "status": "running"},
            status=200,
        )

        responses.add(
            responses.POST,
            f"{CLAUDE_CODE_BASE_URL}/v1/sessions/{session_id}/events",
            body="data: {}\n\n",
            status=200,
        )

        integration = self.create_provider_integration(
            provider="claude_code",
            name="Claude Code Agent",
            external_id="claude-code-ext",
            metadata=self._make_metadata(api_key="sk-ant-test-key"),
        )

        installation = integration.get_installation(organization_id=self.organization.id)

        request = CodingAgentLaunchRequest(
            prompt="Fix the bug in the authentication flow",
            repository=SeerRepoDefinition(
                organization_id=self.organization.id,
                integration_id="123",
                provider="github",
                owner="testorg",
                name="testrepo",
                external_id="456",
                branch_name="main",
            ),
            branch_name="fix-auth-bug",
            auto_create_pr=False,
        )

        result = cast(ClaudeCodeAgentIntegration, installation).launch(request=request)

        assert result.id == session_id
        assert result.status == CodingAgentStatus.PENDING
        assert result.provider == CodingAgentProviderType.CLAUDE_CODE_AGENT
        assert result.name == "testorg/testrepo"
        assert isinstance(result.started_at, datetime)

    def test_update_organization_config_with_environment_id(self):
        """Test that update_organization_config updates environment_id when provided"""
        integration = self.create_integration(
            organization=self.organization,
            provider="claude_code",
            name="Claude Code Agent",
            external_id="claude-code-ext",
            metadata=self._make_metadata(api_key="sk-ant-old-key"),
        )

        installation = integration.get_installation(organization_id=self.organization.id)

        installation.update_organization_config(
            {
                "environment_id": "env-new-456",
            }
        )

        integration.refresh_from_db()
        assert integration.metadata["environment_id"] == "env-new-456"

    def test_update_organization_config_clears_environment_id(self):
        """Test that update_organization_config clears environment_id when empty string"""
        integration = self.create_integration(
            organization=self.organization,
            provider="claude_code",
            name="Claude Code Agent",
            external_id="claude-code-ext",
            metadata=self._make_metadata(api_key="sk-ant-key", environment_id="env-old"),
        )

        installation = integration.get_installation(organization_id=self.organization.id)

        installation.update_organization_config(
            {
                "environment_id": "",
            }
        )

        integration.refresh_from_db()
        assert integration.metadata["environment_id"] is None

    def test_property_getters(self):
        """Test that api_key and environment_id property getters work"""
        integration = self.create_integration(
            organization=self.organization,
            provider="claude_code",
            name="Claude Code Agent",
            external_id="claude-code-ext",
            metadata=self._make_metadata(
                api_key="sk-ant-test-api-key-value",
                environment_id="env-test-123",
            ),
        )

        installation = cast(
            ClaudeCodeAgentIntegration,
            integration.get_installation(organization_id=self.organization.id),
        )

        assert installation.api_key == "sk-ant-test-api-key-value"
        assert installation.environment_id == "env-test-123"

    def test_property_getters_without_environment_id(self):
        """Test that environment_id returns None when not set"""
        integration = self.create_integration(
            organization=self.organization,
            provider="claude_code",
            name="Claude Code Agent",
            external_id="claude-code-ext",
            metadata=self._make_metadata(api_key="sk-ant-test-api-key-value"),
        )

        installation = cast(
            ClaudeCodeAgentIntegration,
            integration.get_installation(organization_id=self.organization.id),
        )

        assert installation.api_key == "sk-ant-test-api-key-value"
        assert installation.environment_id is None

    @patch("getsentry.integrations.claude_code.client.ClaudeCodeClient.validate_api_key")
    def test_build_integration_creates_unique_installations(self, mock_validate):
        """Test that each call to build_integration creates a unique integration"""
        mock_validate.return_value = True

        state: Mapping[str, Any] = {"api_key": "sk-ant-test-api-key-123"}

        integration_dict_1 = self.provider().build_integration(state)
        integration_dict_2 = self.provider().build_integration(state)
        integration_dict_3 = self.provider().build_integration(state)

        external_ids = {
            integration_dict_1["external_id"],
            integration_dict_2["external_id"],
            integration_dict_3["external_id"],
        }
        assert len(external_ids) == 3, (
            "Each build_integration call should create a unique external_id"
        )

        for integration_dict in [integration_dict_1, integration_dict_2, integration_dict_3]:
            assert "external_id" in integration_dict
            assert "metadata" in integration_dict
            assert integration_dict["metadata"]["domain_name"] == "anthropic.com"
            assert "api_key" in integration_dict["metadata"]

    def test_provider_metadata(self):
        """Test provider key, name, and agent methods"""
        provider = self.provider()
        assert provider.key == "claude_code"
        assert provider.name == PROVIDER_NAME
        assert provider.get_agent_name() == PROVIDER_NAME
        assert provider.get_agent_key() == "claude_code"

    def test_update_environment_id(self):
        """Test that update_environment_id persists the environment ID"""
        integration = self.create_integration(
            organization=self.organization,
            provider="claude_code",
            name="Claude Code Agent",
            external_id="claude-code-ext",
            metadata=self._make_metadata(api_key="sk-ant-test-key"),
        )

        installation = cast(
            ClaudeCodeAgentIntegration,
            integration.get_installation(organization_id=self.organization.id),
        )

        assert installation.environment_id is None

        installation.update_environment_id("env-new-789")

        integration.refresh_from_db()
        assert integration.metadata["environment_id"] == "env-new-789"
        assert integration.metadata["api_key"] == "sk-ant-test-key"
