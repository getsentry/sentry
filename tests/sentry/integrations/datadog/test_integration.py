import hashlib
from typing import Any

import pytest
import responses

from sentry.integrations.datadog.integration import (
    DatadogIntegration,
    DatadogIntegrationProvider,
)
from sentry.shared_integrations.exceptions import IntegrationConfigurationError
from sentry.testutils.cases import IntegrationTestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils import json

MCP_URL = "https://mcp.datadoghq.com/api/unstable/mcp-server/mcp"


def _mock_whoami(whoami: dict[str, Any]) -> None:
    responses.add(responses.POST, MCP_URL, status=200, headers={"mcp-session-id": "sess-1"})
    responses.add(
        responses.POST,
        MCP_URL,
        status=200,
        json={"result": {"contents": [{"text": json.dumps(whoami)}]}},
    )


@control_silo_test
class DatadogIntegrationProviderTest(IntegrationTestCase):
    provider = DatadogIntegrationProvider

    def _provider(self) -> DatadogIntegrationProvider:
        p = self.provider()
        p.set_pipeline(self.pipeline)
        return p

    def _state(self, **overrides: str) -> dict[str, Any]:
        config = {"api_key": "api", "app_key": "app", "site": "datadoghq.com"}
        config.update(overrides)
        return {"config": config}

    def _expected_external_id(self, org_uuid: str) -> str:
        return hashlib.sha256(f"{self.organization.id}:{org_uuid}".encode()).hexdigest()

    @responses.activate
    def test_build_integration_validates_and_stores_metadata(self) -> None:
        _mock_whoami({"user_uuid": "u-1", "org_uuid": "org-123"})

        result = self._provider().build_integration(self._state())

        assert result["external_id"] == self._expected_external_id("org-123")
        assert result["name"] == "Datadog (datadoghq.com)"
        assert result["metadata"] == {"api_key": "api", "app_key": "app", "site": "datadoghq.com"}
        assert responses.calls[0].request.headers["DD-API-KEY"] == "api"
        assert responses.calls[0].request.headers["DD-APPLICATION-KEY"] == "app"

    def test_build_integration_external_id_isolated_per_org(self) -> None:
        other_org = self.create_organization(owner=self.user)
        assert (
            self._expected_external_id("org-123")
            != hashlib.sha256(f"{other_org.id}:org-123".encode()).hexdigest()
        )

    def test_build_integration_requires_config(self) -> None:
        with pytest.raises(IntegrationConfigurationError):
            self._provider().build_integration({})

    @responses.activate
    def test_build_integration_raises_on_invalid_credentials(self) -> None:
        responses.add(responses.POST, MCP_URL, status=403, json={"error": "forbidden"})

        with pytest.raises(IntegrationConfigurationError):
            self._provider().build_integration(self._state())

    def test_installation_reads_credentials(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="datadog",
            external_id="dd-ext",
            name="Datadog (datadoghq.com)",
            metadata={"api_key": "api", "app_key": "app", "site": "datadoghq.com"},
        )
        installation = integration.get_installation(organization_id=self.organization.id)

        assert isinstance(installation, DatadogIntegration)
        assert installation.api_key == "api"
        assert installation.app_key == "app"
        assert installation.site == "datadoghq.com"

    def test_post_install_writes_site_to_debug_data(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="datadog",
            external_id="dd-ext",
            metadata={"api_key": "api", "app_key": "app", "site": "datadoghq.com"},
        )

        self._provider().post_install(integration, self.pipeline.organization, extra={})

        integration.refresh_from_db()
        assert integration.debug_data == {"site": "datadoghq.com"}

    def test_provider_is_single_install_and_flagged(self) -> None:
        provider = self.provider()
        assert provider.key == "datadog"
        assert provider.allow_multiple is False
        assert provider.requires_feature_flag is True
