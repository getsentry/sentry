import json

import pytest
import responses

from sentry.integrations.datadog.integration import (
    DatadogIntegration,
    DatadogIntegrationProvider,
)
from sentry.shared_integrations.exceptions import IntegrationConfigurationError
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test

MCP_URL = "https://mcp.datadoghq.com/api/unstable/mcp-server/mcp"


def _mock_whoami(whoami: dict) -> None:
    responses.add(responses.POST, MCP_URL, status=200, headers={"mcp-session-id": "sess-1"})
    responses.add(
        responses.POST,
        MCP_URL,
        status=200,
        json={"result": {"contents": [{"text": json.dumps(whoami)}]}},
    )


@control_silo_test
class DatadogIntegrationProviderTest(TestCase):
    def setUp(self):
        super().setUp()
        self.provider = DatadogIntegrationProvider()

    def _state(self, **overrides):
        config = {"api_key": "api", "app_key": "app", "site": "datadoghq.com"}
        config.update(overrides)
        return {"config": config}

    @responses.activate
    def test_build_integration_validates_and_stores_metadata(self):
        _mock_whoami({"user_uuid": "u-1", "org_uuid": "org-123"})

        result = self.provider.build_integration(self._state())

        assert result["external_id"] == "org-123"
        assert result["name"] == "Datadog (datadoghq.com)"
        assert result["metadata"] == {"api_key": "api", "app_key": "app", "site": "datadoghq.com"}
        assert responses.calls[0].request.headers["DD-API-KEY"] == "api"
        assert responses.calls[0].request.headers["DD-APPLICATION-KEY"] == "app"

    def test_build_integration_requires_config(self):
        with pytest.raises(IntegrationConfigurationError):
            self.provider.build_integration({})

    @responses.activate
    def test_build_integration_raises_on_invalid_credentials(self):
        responses.add(responses.POST, MCP_URL, status=403, json={"error": "forbidden"})

        with pytest.raises(IntegrationConfigurationError):
            self.provider.build_integration(self._state())

    def test_installation_reads_credentials(self):
        integration = self.create_integration(
            organization=self.organization,
            provider="datadog",
            external_id="org-123",
            name="Datadog (datadoghq.com)",
            metadata={"api_key": "api", "app_key": "app", "site": "datadoghq.com"},
        )
        installation = integration.get_installation(organization_id=self.organization.id)

        assert isinstance(installation, DatadogIntegration)
        assert installation.api_key == "api"
        assert installation.app_key == "app"
        assert installation.site == "datadoghq.com"

    def test_provider_is_single_install_and_flagged(self):
        assert self.provider.key == "datadog"
        assert self.provider.allow_multiple is False
        assert self.provider.requires_feature_flag is True
