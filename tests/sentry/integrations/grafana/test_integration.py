from typing import Any

import pytest
import responses
from django.urls import reverse

from sentry.integrations.grafana.client import (
    GRAFANA_INVALID_TOKEN_MESSAGE,
    GRAFANA_INVALID_URL_MESSAGE,
)
from sentry.integrations.grafana.integration import (
    GrafanaIntegration,
    GrafanaIntegrationProvider,
)
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.shared_integrations.exceptions import IntegrationConfigurationError
from sentry.testutils.cases import APITestCase, IntegrationTestCase
from sentry.testutils.silo import control_silo_test

GRAFANA_URL = "https://example-stack.grafana.net"
DATASOURCES = [
    {"uid": "prom-uid", "name": "Prometheus", "type": "prometheus", "url": "https://prom"},
    {"uid": "loki-uid", "name": "Loki", "type": "loki", "url": "https://loki"},
]


def mock_grafana(
    *,
    url: str = GRAFANA_URL,
    datasources_status: int = 200,
    datasources: Any = DATASOURCES,
) -> None:
    responses.add(responses.GET, f"{url}/api/health", json={"database": "ok", "version": "13.3.0"})
    responses.add(
        responses.GET, f"{url}/api/datasources", status=datasources_status, json=datasources
    )


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

    @responses.activate
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
        assert len(responses.calls) == 0

    def test_build_integration_raises_when_config_is_missing(self) -> None:
        with pytest.raises(IntegrationConfigurationError):
            self._provider().build_integration({})

    @responses.activate
    def test_build_integration_raises_for_non_cloud_grafana_url(self) -> None:
        with pytest.raises(IntegrationConfigurationError, match="Grafana Cloud URL"):
            self._provider().build_integration(self._pipeline_state(url="https://grafana.internal"))

        assert len(responses.calls) == 0

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

    @responses.activate
    def test_update_organization_config_saves_new_token(self) -> None:
        integration = self._create_integration()
        mock_grafana()

        self._installation(integration).update_organization_config(
            {"url": GRAFANA_URL, "token": "glsa_new_wxyz"}
        )

        integration.refresh_from_db()
        assert integration.metadata == {"token": "glsa_new_wxyz"}
        assert "token" not in self._org_integration_config(integration)
        assert responses.calls[1].request.headers["Authorization"] == "Bearer glsa_new_wxyz"

    @responses.activate
    def test_update_organization_config_renames_integration_when_url_changes(self) -> None:
        other_grafana_url = "https://other-stack.grafana.net"

        integration = self._create_integration()
        mock_grafana(url=other_grafana_url)

        self._installation(integration).update_organization_config({"url": other_grafana_url})

        integration.refresh_from_db()
        assert integration.name == "Grafana (other-stack.grafana.net)"
        assert integration.metadata == {"token": "glsa_old_abcd"}
        assert self._org_integration_config(integration)["url"] == other_grafana_url

    @responses.activate
    def test_update_organization_config_raises_when_validate_connection_fails_for_new_token(
        self,
    ) -> None:
        integration = self._create_integration()
        mock_grafana(datasources_status=401, datasources={"messageId": "api-key.invalid"})

        with pytest.raises(IntegrationConfigurationError, match="rejected the token"):
            self._installation(integration).update_organization_config({"token": "glsa_bad_0000"})

        integration.refresh_from_db()
        assert integration.metadata == {"token": "glsa_old_abcd"}

    @responses.activate
    def test_update_organization_config_raises_when_validate_connection_fails_without_changes(
        self,
    ) -> None:
        integration = self._create_integration()
        mock_grafana(datasources_status=401, datasources={"messageId": "api-key.invalid"})

        # The settings form sends the stored URL and a blank token.
        with pytest.raises(IntegrationConfigurationError, match="rejected the token"):
            self._installation(integration).update_organization_config(
                {"url": GRAFANA_URL, "token": ""}
            )

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


@control_silo_test
class GrafanaApiPipelineTest(APITestCase):
    endpoint = "sentry-api-0-organization-pipeline"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def _initialize_pipeline(self) -> str:
        url = reverse(self.endpoint, args=[self.organization.slug, "integration_pipeline"])
        with self.feature("organizations:integrations-grafana"):
            response = self.client.post(
                url, data={"action": "initialize", "provider": "grafana"}, format="json"
            )
        assert response.status_code == 200
        assert response.data["step"] == "grafana_credentials"
        return url

    @responses.activate
    def test_retry_after_rejected_token(self) -> None:
        url = self._initialize_pipeline()
        mock_grafana(datasources_status=401, datasources={"messageId": "api-key.invalid"})

        response = self.client.post(
            url, data={"url": GRAFANA_URL, "token": "glsa_bad"}, format="json"
        )

        assert response.status_code == 400
        assert response.data["data"]["detail"] == GRAFANA_INVALID_TOKEN_MESSAGE
        assert not Integration.objects.filter(provider="grafana").exists()

        response = self.client.get(url)
        assert response.status_code == 200
        assert response.data["step"] == "grafana_credentials"
        assert response.data["stepIndex"] == 0

        responses.replace(responses.GET, f"{GRAFANA_URL}/api/datasources", json=DATASOURCES)
        response = self.client.post(
            url,
            data={"url": "https://Example-Stack.grafana.net/", "token": "glsa_corrected"},
            format="json",
        )

        assert response.status_code == 200
        assert response.data["status"] == "complete"
        integration = Integration.objects.get(
            provider="grafana", external_id=str(self.organization.id)
        )
        assert integration.metadata == {"token": "glsa_corrected"}
        assert OrganizationIntegration.objects.get(
            organization_id=self.organization.id, integration_id=integration.id
        ).config == {"url": GRAFANA_URL}
        assert len(responses.calls) == 4
        assert responses.calls[-1].request.headers["Authorization"] == "Bearer glsa_corrected"

    @responses.activate
    def test_retry_after_malformed_url(self) -> None:
        url = self._initialize_pipeline()

        response = self.client.post(
            url,
            data={"url": "https://[example-stack.grafana.net", "token": "glsa_token"},
            format="json",
        )

        assert response.status_code == 400
        assert response.data["data"]["detail"] == GRAFANA_INVALID_URL_MESSAGE
        assert not Integration.objects.filter(provider="grafana").exists()
        assert len(responses.calls) == 0

        mock_grafana()
        response = self.client.post(
            url, data={"url": GRAFANA_URL, "token": "glsa_token"}, format="json"
        )

        assert response.status_code == 200
        assert response.data["status"] == "complete"
        assert len(responses.calls) == 2

    @responses.activate
    def test_settings_reject_malformed_url(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="grafana",
            external_id=str(self.organization.id),
            metadata={"token": "glsa_token"},
            oi_params={"config": {"url": GRAFANA_URL}},
        )
        url = reverse(
            "sentry-api-0-organization-integration-details",
            args=[self.organization.slug, integration.id],
        )

        response = self.client.post(
            url, data={"url": "https://[example-stack.grafana.net"}, format="json"
        )

        assert response.status_code == 400
        assert response.data["detail"] == GRAFANA_INVALID_URL_MESSAGE
        assert len(responses.calls) == 0
        integration.refresh_from_db()
        assert integration.metadata == {"token": "glsa_token"}
        assert OrganizationIntegration.objects.get(
            organization_id=self.organization.id, integration_id=integration.id
        ).config == {"url": GRAFANA_URL}
