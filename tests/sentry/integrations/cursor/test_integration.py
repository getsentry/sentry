from collections.abc import Mapping
from typing import Any, cast, int
from unittest.mock import MagicMock, patch

import pytest

from sentry.integrations.cursor.integration import CursorAgentIntegrationProvider
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.testutils.cases import IntegrationTestCase
from sentry.testutils.silo import assume_test_silo_mode_of


class CursorIntegrationTest(IntegrationTestCase):
    provider = CursorAgentIntegrationProvider

    def test_build_integration(self):
        state: Mapping[str, Any] = {"config": {"api_key": "test_api_key_123"}}

        integration_dict = self.provider().build_integration(state)

        assert integration_dict["external_id"] == "cursor"
        assert integration_dict["name"] == "Cursor Agent"
        assert integration_dict["metadata"]["api_key"] == "test_api_key_123"
        assert integration_dict["metadata"]["domain_name"] == "cursor.sh"

        # Verify webhook secret is generated
        assert "webhook_secret" in integration_dict["metadata"]
        webhook_secret = integration_dict["metadata"]["webhook_secret"]
        assert isinstance(webhook_secret, str)
        assert len(webhook_secret) == 64  # generate_token() creates 64-char hex string
        assert 32 <= len(webhook_secret) <= 256  # Meets Cursor requirements

    def test_build_integration_missing_config(self):
        """Test that build_integration raises error when config is missing"""
        state: Mapping[str, Any] = {}

        with pytest.raises(IntegrationError, match="Missing configuration data"):
            self.provider().build_integration(state)

    def test_build_integration_empty_config(self):
        """Test that build_integration raises error when config is empty"""
        state: Mapping[str, Any] = {"config": {}}

        with pytest.raises(IntegrationError, match="Missing configuration data"):
            self.provider().build_integration(state)

    def test_get_client(self):
        integration = self.create_provider_integration(
            provider="cursor",
            name="Cursor Agent",
            external_id="cursor",
            metadata={
                "api_key": "test_api_key_123",
                "domain_name": "cursor.sh",
                "webhook_secret": "test_secret_123",
            },
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

        # Mock the response
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

        integration = self.create_provider_integration(
            provider="cursor",
            name="Cursor Agent",
            external_id="cursor",
            metadata={
                "api_key": "test_api_key_123",
                "domain_name": "cursor.sh",
                "webhook_secret": "test_secret_123",
            },
        )

        installation = integration.get_installation(organization_id=self.organization.id)

        # Create a launch request
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

        # Cast to concrete integration type to access launch()
        from sentry.integrations.cursor.integration import CursorAgentIntegration

        result = cast(CursorAgentIntegration, installation).launch(request=request)

        assert result.id == "test_session_123"
        assert result.status == CodingAgentStatus.RUNNING
        assert result.provider == CodingAgentProviderType.CURSOR_BACKGROUND_AGENT
        assert result.name == "Test Session"

        # Verify the API call
        mock_post.assert_called_once()
        call_args = mock_post.call_args
        assert call_args[0][0] == "/v0/agents"

    def test_update_organization_config_persists_api_key_and_clears_org_config(self):
        # Create a Cursor integration linked to this organization
        integration = self.create_integration(
            organization=self.organization,
            provider="cursor",
            name="Cursor Agent",
            external_id="cursor",
            metadata={
                "api_key": "old_key",
                "domain_name": "cursor.sh",
                "webhook_secret": "secret123",
            },
        )

        installation = integration.get_installation(organization_id=self.organization.id)

        # Call update with a new API key
        installation.update_organization_config({"api_key": "new_secret_key"})

        # Metadata should be updated on the Integration
        integration.refresh_from_db()
        assert integration.metadata["api_key"] == "new_secret_key"

        # OrganizationIntegration config should remain empty (no secret stored there)
        from sentry.integrations.models.organization_integration import OrganizationIntegration

        with assume_test_silo_mode_of(OrganizationIntegration):
            org_integration = OrganizationIntegration.objects.get(
                integration_id=integration.id, organization_id=self.organization.id
            )
            assert org_integration.config == {}

    def test_update_organization_config_missing_api_key_raises(self):
        # Create a Cursor integration linked to this organization
        integration = self.create_integration(
            organization=self.organization,
            provider="cursor",
            name="Cursor Agent",
            external_id="cursor",
            metadata={
                "api_key": "present_key",
                "domain_name": "cursor.sh",
                "webhook_secret": "secret123",
            },
        )

        installation = integration.get_installation(organization_id=self.organization.id)

        # Missing api_key should raise
        with pytest.raises(IntegrationError, match="API key is required"):
            installation.update_organization_config({})
