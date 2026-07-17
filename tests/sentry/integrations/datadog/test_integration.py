import hashlib
import os
import re
from typing import Any

import pytest
import responses

from sentry.identity.datadog.provider import DATADOG_VALID_SITES
from sentry.integrations.datadog.integration import (
    DatadogIntegration,
    DatadogIntegrationProvider,
)
from sentry.shared_integrations.exceptions import IntegrationConfigurationError
from sentry.testutils.cases import IntegrationTestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils import json

MCP_URL = "https://mcp.datadoghq.com/api/unstable/mcp-server/mcp"


def test_frontend_datadog_sites_match_backend() -> None:
    """The frontend site list is hand-maintained in a second language, so guard against it
    drifting from DATADOG_VALID_SITES (the backend source of truth)."""
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), *([".."] * 4)))
    fe_path = os.path.join(repo_root, "static/app/utils/seer/datadogSites.ts")
    with open(fe_path) as f:
        frontend_sites = set(re.findall(r"value: '([^']+)'", f.read()))

    assert frontend_sites == set(DATADOG_VALID_SITES)


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

    def test_get_organization_config_and_config_data(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="datadog",
            external_id="dd-ext",
            metadata={"api_key": "api", "app_key": "app", "site": "datadoghq.com"},
        )
        installation = integration.get_installation(organization_id=self.organization.id)

        assert [f["name"] for f in installation.get_organization_config()] == [
            "site",
            "api_key",
            "app_key",
        ]
        assert installation.get_config_data()["site"] == "datadoghq.com"

    @responses.activate
    def test_update_organization_config_revalidates_and_persists(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="datadog",
            external_id="dd-ext",
            metadata={"api_key": "old-api", "app_key": "old-app", "site": "datadoghq.com"},
        )
        installation = integration.get_installation(organization_id=self.organization.id)
        _mock_whoami({"user_uuid": "u-1", "org_uuid": "org-123"})

        installation.update_organization_config(
            {"api_key": "new-api", "app_key": "new-app", "site": "datadoghq.com"}
        )

        integration.refresh_from_db()
        assert integration.metadata == {
            "api_key": "new-api",
            "app_key": "new-app",
            "site": "datadoghq.com",
        }
        assert responses.calls[0].request.headers["DD-API-KEY"] == "new-api"

    @responses.activate
    def test_update_organization_config_keeps_omitted_secrets(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="datadog",
            external_id="dd-ext",
            metadata={"api_key": "api", "app_key": "app", "site": "datadoghq.com"},
        )
        installation = integration.get_installation(organization_id=self.organization.id)
        _mock_whoami({"user_uuid": "u-1", "org_uuid": "org-123"})

        installation.update_organization_config({"site": "datadoghq.com"})

        integration.refresh_from_db()
        assert integration.metadata == {"api_key": "api", "app_key": "app", "site": "datadoghq.com"}
        assert responses.calls[0].request.headers["DD-API-KEY"] == "api"

    @responses.activate
    def test_update_organization_config_syncs_name_on_site_change(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="datadog",
            external_id="dd-ext",
            name="Datadog (datadoghq.com)",
            metadata={"api_key": "api", "app_key": "app", "site": "datadoghq.com"},
        )
        installation = integration.get_installation(organization_id=self.organization.id)
        eu_url = "https://mcp.datadoghq.eu/api/unstable/mcp-server/mcp"
        responses.add(responses.POST, eu_url, status=200, headers={"mcp-session-id": "sess-1"})
        responses.add(
            responses.POST,
            eu_url,
            status=200,
            json={
                "result": {
                    "contents": [{"text": json.dumps({"user_uuid": "u-1", "org_uuid": "org-123"})}]
                }
            },
        )

        installation.update_organization_config({"site": "datadoghq.eu"})

        integration.refresh_from_db()
        assert integration.metadata["site"] == "datadoghq.eu"
        assert integration.name == "Datadog (datadoghq.eu)"

    def test_provider_is_single_install_and_flagged(self) -> None:
        provider = self.provider()
        assert provider.key == "datadog"
        assert provider.allow_multiple is False
        assert provider.requires_feature_flag is True
