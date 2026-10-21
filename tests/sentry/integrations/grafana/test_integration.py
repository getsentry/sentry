from typing import Any

import pytest

from sentry.integrations.grafana.integration import (
    GrafanaIntegration,
    GrafanaIntegrationProvider,
)
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.shared_integrations.exceptions import IntegrationConfigurationError
from sentry.testutils.cases import IntegrationTestCase
from sentry.testutils.silo import control_silo_test

GRAFANA_URL = "https://example-stack.grafana.net"


@control_silo_test
class GrafanaIntegrationProviderTest(IntegrationTestCase):
    provider = GrafanaIntegrationProvider

    def _provider(self) -> GrafanaIntegrationProvider:
        p = self.provider()
        p.set_pipeline(self.pipeline)
        return p

    def _pipeline_state(self, **overrides: str) -> dict[str, Any]:
        return {"config": {"url": GRAFANA_URL, "token": "glsa_old_abcd", **overrides}}

    def _create_integration(self) -> Integration:
        return self.create_integration(
            organization=self.organization,
            provider="grafana",
            external_id=str(self.organization.id),
            name="Grafana (example-stack.grafana.net)",
            metadata={"token": "glsa_old_abcd"},
            oi_params={"config": {"url": GRAFANA_URL}},
        )

    def _installation(self, integration: Integration) -> GrafanaIntegration:
        installation = integration.get_installation(organization_id=self.organization.id)
        assert isinstance(installation, GrafanaIntegration)
        return installation

    def _org_integration_config(self, integration: Integration) -> dict[str, Any]:
        return OrganizationIntegration.objects.get(
            organization_id=self.organization.id, integration_id=integration.id
        ).config

    def test_build_integration_stores_token_in_metadata_and_url_in_post_install_config(
        self,
    ) -> None:
        result = self._provider().build_integration(
            self._pipeline_state(url="https://Example-Stack.grafana.net/")
        )

        assert result["external_id"] == str(self.organization.id)
        assert result["name"] == "Grafana (example-stack.grafana.net)"
        assert result["metadata"] == {"token": "glsa_old_abcd"}
        assert result["post_install_data"] == {"config": {"url": GRAFANA_URL}}

    def test_build_integration_raises_when_config_is_missing(self) -> None:
        with pytest.raises(IntegrationConfigurationError):
            self._provider().build_integration({})

    def test_build_integration_raises_for_non_cloud_grafana_url(self) -> None:
        with pytest.raises(IntegrationConfigurationError, match="Grafana Cloud URL"):
            self._provider().build_integration(self._pipeline_state(url="https://grafana.internal"))

    def test_post_install_writes_config_to_org_integration(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="grafana",
            external_id=str(self.organization.id),
            metadata={"token": "glsa_old_abcd"},
        )
        config = {"url": GRAFANA_URL}

        self._provider().post_install(
            integration, self.pipeline.organization, extra={"config": config}
        )

        assert self._org_integration_config(integration) == config

    def test_get_organization_config_returns_url_and_token_fields(self) -> None:
        installation = self._installation(self._create_integration())

        fields = installation.get_organization_config()

        assert [f["name"] for f in fields] == ["url", "token"]

    def test_update_organization_config_saves_new_token(self) -> None:
        integration = self._create_integration()

        self._installation(integration).update_organization_config(
            {"url": GRAFANA_URL, "token": "glsa_new_wxyz"}
        )

        integration.refresh_from_db()
        assert integration.metadata == {"token": "glsa_new_wxyz"}
        assert "token" not in self._org_integration_config(integration)

    def test_update_organization_config_renames_integration_when_url_changes(self) -> None:
        other_grafana_url = "https://other-stack.grafana.net"

        integration = self._create_integration()

        self._installation(integration).update_organization_config({"url": other_grafana_url})

        integration.refresh_from_db()
        assert integration.name == "Grafana (other-stack.grafana.net)"
        assert integration.metadata == {"token": "glsa_old_abcd"}
        assert self._org_integration_config(integration)["url"] == other_grafana_url

    def test_update_organization_config_raises_for_non_cloud_grafana_url(self) -> None:
        integration = self._create_integration()

        with pytest.raises(IntegrationConfigurationError, match="Grafana Cloud URL"):
            self._installation(integration).update_organization_config(
                {"url": "https://example-stack.grafana.net:8443"}
            )

    def test_provider_is_single_install_and_flagged(self) -> None:
        provider = self.provider()
        assert provider.key == "grafana"
        assert provider.name == "Grafana for Seer"
        assert provider.allow_multiple is False
        assert provider.requires_feature_flag is True
