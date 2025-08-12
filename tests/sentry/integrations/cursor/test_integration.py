from unittest.mock import patch

import pytest

from sentry.integrations.cursor.integration import CursorAgentIntegrationProvider
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.testutils.cases import IntegrationTestCase


class CursorIntegrationTest(IntegrationTestCase):
    provider = CursorAgentIntegrationProvider

    def test_build_integration(self):
        state = {"config": {"api_key": "test_api_key_123"}}

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
        state = {}

        with pytest.raises(IntegrationError, match="Missing configuration data"):
            self.provider().build_integration(state)

    def test_build_integration_empty_config(self):
        """Test that build_integration raises error when config is empty"""
        state = {"config": {}}

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
        assert client.base_url == "https://api.cursor.sh/v1"

    @patch("sentry.integrations.cursor.client.CursorAgentClient.request")
    def test_launch(self, mock_request):
        mock_request.return_value = {"status": "launched", "session_id": "test_123"}

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

        result = installation.launch(context={"test": "data"})

        assert result["status"] == "launched"
        assert result["session_id"] == "test_123"

        # Verify the request was made correctly
        mock_request.assert_called_once_with(
            "POST",
            "/launch",
            json={
                "webhook_url": "http://testserver/extensions/cursor/webhook/",
                "context": {"test": "data"},
            },
        )
