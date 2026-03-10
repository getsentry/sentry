"""
Tests for ClaudeCodeAgentIntegration and ClaudeCodeAgentIntegrationProvider.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, cast
from unittest.mock import MagicMock, patch

import pytest

from sentry.integrations.claude_code.integration import (
    PROVIDER_KEY,
    PROVIDER_NAME,
    ClaudeCodeAgentIntegration,
    ClaudeCodeAgentIntegrationProvider,
)
from sentry.shared_integrations.exceptions import IntegrationConfigurationError
from sentry.testutils.cases import IntegrationTestCase

MOCK_GET_CLIENT_CLASS = "sentry.integrations.claude_code.integration._get_client_class"


def _mock_client_class(validate_return=True, validate_side_effect=None, **client_attrs):
    """Create a mock client class whose instances have validate_api_key and optional attributes."""
    mock_client = MagicMock()
    if validate_side_effect:
        mock_client.validate_api_key.side_effect = validate_side_effect
    else:
        mock_client.validate_api_key.return_value = validate_return
    for k, v in client_attrs.items():
        setattr(mock_client, k, v)
    mock_cls = MagicMock(return_value=mock_client)
    return mock_cls, mock_client


class ClaudeCodeIntegrationTest(IntegrationTestCase):
    provider = ClaudeCodeAgentIntegrationProvider

    def _make_metadata(self, **overrides):
        defaults = {
            "api_key": "sk-ant-test-api-key-123",
            "domain_name": "anthropic.com",
        }
        defaults.update(overrides)
        return defaults

    def _create_installation(self, **metadata_overrides) -> ClaudeCodeAgentIntegration:
        """Helper to create an integration and return its installation."""
        integration = self.create_integration(
            organization=self.organization,
            provider="claude_code",
            name="Claude Code Agent",
            external_id="claude-code-ext",
            metadata=self._make_metadata(**metadata_overrides),
        )
        return cast(
            ClaudeCodeAgentIntegration,
            integration.get_installation(organization_id=self.organization.id),
        )

    # ── Provider metadata ────────────────────────────────────────────

    def test_provider_metadata(self):
        p = self.provider()
        assert p.key == PROVIDER_KEY
        assert p.name == PROVIDER_NAME
        assert p.get_agent_name() == PROVIDER_NAME
        assert p.get_agent_key() == PROVIDER_KEY

    # ── build_integration ────────────────────────────────────────────

    def test_build_integration(self):
        mock_cls, mock_client = _mock_client_class()
        state: Mapping[str, Any] = {"api_key": "sk-ant-test-api-key-123"}

        with patch(MOCK_GET_CLIENT_CLASS, return_value=mock_cls):
            result = self.provider().build_integration(state)

        mock_client.validate_api_key.assert_called_once()
        assert result["name"] == PROVIDER_NAME
        assert result["external_id"]  # UUID hex string
        metadata = result["metadata"]
        assert metadata["api_key"] == "sk-ant-test-api-key-123"
        assert metadata["domain_name"] == "anthropic.com"
        assert metadata["environment_id"] is None
        assert metadata["workspace_name"] is None
        assert metadata["agent_id"] is None
        assert metadata["agent_version"] is None

    def test_build_integration_with_environment_and_workspace(self):
        mock_cls, _ = _mock_client_class()
        state: Mapping[str, Any] = {
            "api_key": "sk-ant-api-key",
            "environment": {
                "environment_id": "env-123",
                "workspace_name": "my-workspace",
            },
        }

        with patch(MOCK_GET_CLIENT_CLASS, return_value=mock_cls):
            result = self.provider().build_integration(state)

        metadata = result["metadata"]
        assert metadata["environment_id"] == "env-123"
        assert metadata["workspace_name"] == "my-workspace"

    def test_build_integration_creates_unique_external_ids(self):
        mock_cls, _ = _mock_client_class()
        state: Mapping[str, Any] = {"api_key": "sk-ant-test-api-key-123"}

        with patch(MOCK_GET_CLIENT_CLASS, return_value=mock_cls):
            r1 = self.provider().build_integration(state)
            r2 = self.provider().build_integration(state)

        assert r1["external_id"] != r2["external_id"]

    def test_build_integration_missing_api_key(self):
        with pytest.raises(IntegrationConfigurationError, match="Missing API key"):
            self.provider().build_integration({})

    def test_build_integration_invalid_api_key(self):
        mock_cls, _ = _mock_client_class(validate_return=False)

        with patch(MOCK_GET_CLIENT_CLASS, return_value=mock_cls):
            with pytest.raises(
                IntegrationConfigurationError,
                match="Invalid Anthropic API key",
            ):
                self.provider().build_integration({"api_key": "invalid-key"})

    def test_build_integration_validation_network_error(self):
        mock_cls, _ = _mock_client_class(validate_side_effect=Exception("Network error"))

        with patch(MOCK_GET_CLIENT_CLASS, return_value=mock_cls):
            with pytest.raises(
                IntegrationConfigurationError,
                match="Unable to validate Anthropic API key",
            ):
                self.provider().build_integration({"api_key": "sk-ant-key"})

    # ── get_client ───────────────────────────────────────────────────

    def test_get_client(self):
        mock_cls, mock_client = _mock_client_class()
        integration = self.create_provider_integration(
            provider="claude_code",
            name="Claude Code Agent",
            external_id="claude-code-ext-123",
            metadata=self._make_metadata(),
        )
        installation = integration.get_installation(organization_id=self.organization.id)

        with patch(MOCK_GET_CLIENT_CLASS, return_value=mock_cls):
            client = installation.get_client()

        assert client is mock_client
        mock_cls.assert_called_once_with(
            api_key="sk-ant-test-api-key-123",
            environment_id=None,
            workspace_name=None,
            agent_id=None,
            agent_version=None,
        )

    def test_get_client_with_environment_and_workspace(self):
        mock_cls, mock_client = _mock_client_class()
        integration = self.create_provider_integration(
            provider="claude_code",
            name="Claude Code Agent",
            external_id="claude-code-ext-123",
            metadata=self._make_metadata(
                environment_id="env-456",
                workspace_name="my-ws",
                agent_id="agent-123",
                agent_version="v1",
            ),
        )
        installation = integration.get_installation(organization_id=self.organization.id)

        with patch(MOCK_GET_CLIENT_CLASS, return_value=mock_cls):
            client = installation.get_client()

        assert client is mock_client
        mock_cls.assert_called_once_with(
            api_key="sk-ant-test-api-key-123",
            environment_id="env-456",
            workspace_name="my-ws",
            agent_id="agent-123",
            agent_version="v1",
        )

    def test_get_client_class_not_configured(self):
        installation = self._create_installation()

        with self.settings(CLAUDE_CODE_CLIENT_CLASS=None):
            with pytest.raises(IntegrationConfigurationError, match="not configured"):
                installation.get_client()

    # ── Property getters ─────────────────────────────────────────────

    def test_property_getters(self):
        installation = self._create_installation(
            api_key="sk-ant-prop-key",
            environment_id="env-prop-123",
        )

        assert installation.api_key == "sk-ant-prop-key"
        assert installation.model.metadata["environment_id"] == "env-prop-123"

    def test_environment_id_defaults_to_none(self):
        installation = self._create_installation()
        assert installation.model.metadata.get("environment_id") is None

    # ── update_organization_config ───────────────────────────────────

    def test_update_organization_config_sets_environment_id(self):
        installation = self._create_installation()
        installation.update_organization_config({"environment_id": "env-new-456"})

        assert installation.model.metadata["environment_id"] == "env-new-456"

    def test_update_organization_config_clears_environment_id(self):
        installation = self._create_installation(environment_id="env-old")
        installation.update_organization_config({"environment_id": ""})

        assert installation.model.metadata["environment_id"] is None

    def test_update_organization_config_sets_workspace_name(self):
        installation = self._create_installation()
        installation.update_organization_config({"workspace_name": "my-workspace"})

        assert installation.model.metadata["workspace_name"] == "my-workspace"

    def test_update_organization_config_clears_workspace_name(self):
        installation = self._create_installation(workspace_name="old-ws")
        installation.update_organization_config({"workspace_name": ""})

        assert installation.model.metadata["workspace_name"] is None

    # ── get_config_data ──────────────────────────────────────────────

    def test_get_config_data(self):
        installation = self._create_installation(
            environment_id="env-cfg",
            workspace_name="ws-cfg",
        )
        data = installation.get_config_data()

        assert data["environment_id"] == "env-cfg"
        assert data["workspace_name"] == "ws-cfg"

    def test_get_config_data_defaults_to_empty_strings(self):
        installation = self._create_installation()
        data = installation.get_config_data()

        assert data["environment_id"] == ""
        assert data["workspace_name"] == ""

    # ── launch ───────────────────────────────────────────────────────

    def _setup_launch(
        self,
        environment_id=None,
        client_environment_id=None,
        agent_id=None,
        agent_version=None,
        client_agent_id=None,
        client_agent_version=None,
    ):
        """Set up mocks for launch tests. Returns (installation, mock_client, mock_cls, request)."""
        from sentry.integrations.coding_agent.models import CodingAgentLaunchRequest
        from sentry.seer.autofix.utils import CodingAgentProviderType, CodingAgentStatus
        from sentry.seer.models import SeerRepoDefinition

        mock_cls, mock_client = _mock_client_class()
        mock_client.environment_id = client_environment_id
        mock_client.agent_id = client_agent_id
        mock_client.agent_version = client_agent_version

        mock_state = MagicMock()
        mock_state.id = "session-456"
        mock_state.status = CodingAgentStatus.PENDING
        mock_state.provider = CodingAgentProviderType.CLAUDE_CODE_AGENT
        mock_state.name = "testorg/testrepo"
        mock_client.launch.return_value = mock_state

        metadata_kwargs: dict[str, Any] = {"api_key": "sk-ant-test-key"}
        if environment_id is not None:
            metadata_kwargs["environment_id"] = environment_id
        if agent_id is not None:
            metadata_kwargs["agent_id"] = agent_id
        if agent_version is not None:
            metadata_kwargs["agent_version"] = agent_version

        integration = self.create_integration(
            organization=self.organization,
            provider="claude_code",
            name="Claude Code Agent",
            external_id="claude-code-ext",
            metadata=self._make_metadata(**metadata_kwargs),
        )
        installation = cast(
            ClaudeCodeAgentIntegration,
            integration.get_installation(organization_id=self.organization.id),
        )

        request = CodingAgentLaunchRequest(
            prompt="Fix the bug",
            repository=SeerRepoDefinition(
                organization_id=self.organization.id,
                integration_id="123",
                provider="github",
                owner="testorg",
                name="testrepo",
                external_id="456",
                branch_name="main",
            ),
            branch_name="fix-bug",
            auto_create_pr=False,
        )

        return installation, mock_client, mock_cls, request

    def test_launch_calls_client_with_webhook_url(self):
        installation, mock_client, mock_cls, request = self._setup_launch()

        with patch(MOCK_GET_CLIENT_CLASS, return_value=mock_cls):
            result = installation.launch(request=request)

        assert result.id == "session-456"
        mock_client.launch.assert_called_once()
        call_kwargs = mock_client.launch.call_args[1]
        assert "webhook_url" in call_kwargs
        assert "/extensions/claude_code/" in call_kwargs["webhook_url"]
        assert call_kwargs["request"] is request

    def test_launch_updates_environment_id_when_changed(self):
        """When the client resolves a new environment_id, it should be persisted."""
        installation, mock_client, mock_cls, request = self._setup_launch(
            environment_id=None,
            client_environment_id="env-resolved-123",
        )

        with patch(MOCK_GET_CLIENT_CLASS, return_value=mock_cls):
            installation.launch(request=request)

        assert installation.model.metadata["environment_id"] == "env-resolved-123"

    def test_launch_does_not_update_metadata_when_unchanged(self):
        """When client IDs match stored ones, metadata should not be persisted."""
        installation, mock_client, mock_cls, request = self._setup_launch(
            environment_id="env-same",
            client_environment_id="env-same",
            agent_id="agent-same",
            agent_version="v-same",
            client_agent_id="agent-same",
            client_agent_version="v-same",
        )

        with patch(MOCK_GET_CLIENT_CLASS, return_value=mock_cls):
            with patch.object(installation, "_persist_metadata") as mock_persist:
                installation.launch(request=request)

        mock_persist.assert_not_called()

    def test_launch_does_not_update_when_client_has_no_ids(self):
        """When client IDs are None, no update should happen."""
        installation, mock_client, mock_cls, request = self._setup_launch(
            environment_id="env-existing",
            client_environment_id=None,
            agent_id="agent-existing",
            agent_version="v-existing",
            client_agent_id=None,
            client_agent_version=None,
        )

        with patch(MOCK_GET_CLIENT_CLASS, return_value=mock_cls):
            with patch.object(installation, "_persist_metadata") as mock_persist:
                installation.launch(request=request)

        mock_persist.assert_not_called()

    def test_launch_updates_agent_id_when_changed(self):
        """When the client resolves a new agent, it should be persisted."""
        installation, mock_client, mock_cls, request = self._setup_launch(
            agent_id=None,
            client_agent_id="agent-new-123",
            client_agent_version="v-new",
        )

        with patch(MOCK_GET_CLIENT_CLASS, return_value=mock_cls):
            installation.launch(request=request)

        assert installation.model.metadata["agent_id"] == "agent-new-123"
        assert installation.model.metadata["agent_version"] == "v-new"

    def test_launch_updates_both_environment_and_agent_when_changed(self):
        """When both IDs change, both should be persisted in a single update."""
        installation, mock_client, mock_cls, request = self._setup_launch(
            environment_id=None,
            client_environment_id="env-new",
            agent_id=None,
            client_agent_id="agent-new",
            client_agent_version="v-new",
        )

        with patch(MOCK_GET_CLIENT_CLASS, return_value=mock_cls):
            installation.launch(request=request)

        assert installation.model.metadata["environment_id"] == "env-new"
        assert installation.model.metadata["agent_id"] == "agent-new"
        assert installation.model.metadata["agent_version"] == "v-new"
