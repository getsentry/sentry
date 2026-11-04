from typing import Any

import pytest
import responses
from django.urls import reverse

from sentry.integrations.linear.client import (
    LINEAR_GRAPHQL_URL,
    LINEAR_INVALID_API_KEY_MESSAGE,
)
from sentry.integrations.linear.integration import (
    LinearIntegration,
    LinearIntegrationProvider,
)
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.shared_integrations.exceptions import IntegrationConfigurationError
from sentry.testutils.cases import APITestCase, IntegrationTestCase
from sentry.testutils.silo import control_silo_test

AUTHENTICATION_ERROR_RESPONSE = {
    "errors": [
        {
            "message": "Authentication required, not authenticated",
            "extensions": {"type": "authentication error", "code": "AUTHENTICATION_ERROR"},
        }
    ]
}


def mock_linear(*, name: str = "Example", status: int = 200, body: Any = None) -> None:
    responses.add(
        responses.POST,
        LINEAR_GRAPHQL_URL,
        status=status,
        json=body if body is not None else {"data": {"organization": {"id": "ws", "name": name}}},
    )


@control_silo_test
class LinearIntegrationProviderTest(IntegrationTestCase):
    provider = LinearIntegrationProvider

    def _provider(self) -> LinearIntegrationProvider:
        p = self.provider()
        p.set_pipeline(self.pipeline)
        return p

    def _create_integration(self) -> Integration:
        return self.create_integration(
            organization=self.organization,
            provider="linear",
            external_id=str(self.organization.id),
            name="Linear (Example)",
            metadata={"api_key": "lin_api_old"},
        )

    def _installation(self, integration: Integration) -> LinearIntegration:
        installation = integration.get_installation(organization_id=self.organization.id)
        assert isinstance(installation, LinearIntegration)
        return installation

    @responses.activate
    def test_build_integration_stores_api_key_in_metadata(self) -> None:
        result = self._provider().build_integration(
            {
                "config": {
                    "api_key": "lin_api_old",
                    "workspace": {"id": "ws", "name": "Example"},
                }
            }
        )

        assert result["external_id"] == str(self.organization.id)
        assert result["name"] == "Linear (Example)"
        assert result["metadata"] == {"api_key": "lin_api_old"}
        # The credentials step already checked the key.
        assert len(responses.calls) == 0

    def test_build_integration_raises_when_config_is_missing(self) -> None:
        with pytest.raises(IntegrationConfigurationError):
            self._provider().build_integration({})

    def test_get_organization_config_returns_api_key_field(self) -> None:
        installation = self._installation(self._create_integration())

        fields = installation.get_organization_config()

        assert [(f["name"], f["type"]) for f in fields] == [("api_key", "secret")]

    def test_get_config_data_does_not_expose_api_key(self) -> None:
        installation = self._installation(self._create_integration())

        assert "api_key" not in installation.get_config_data()

    @responses.activate
    def test_update_organization_config_saves_new_api_key(self) -> None:
        integration = self._create_integration()
        mock_linear(name="Renamed")

        self._installation(integration).update_organization_config({"api_key": " lin_api_new "})

        integration.refresh_from_db()
        assert integration.metadata == {"api_key": "lin_api_new"}
        assert integration.name == "Linear (Renamed)"
        assert "api_key" not in OrganizationIntegration.objects.get(integration=integration).config
        assert responses.calls[0].request.headers["Authorization"] == "lin_api_new"

    @responses.activate
    def test_update_organization_config_retests_stored_api_key_when_blank(self) -> None:
        integration = self._create_integration()
        mock_linear()

        self._installation(integration).update_organization_config({"api_key": ""})

        integration.refresh_from_db()
        assert integration.metadata == {"api_key": "lin_api_old"}
        assert responses.calls[0].request.headers["Authorization"] == "lin_api_old"

    @responses.activate
    def test_update_organization_config_raises_and_keeps_old_key_when_new_key_is_rejected(
        self,
    ) -> None:
        integration = self._create_integration()
        mock_linear(status=401, body=AUTHENTICATION_ERROR_RESPONSE)

        with pytest.raises(IntegrationConfigurationError, match="rejected the API key"):
            self._installation(integration).update_organization_config({"api_key": "lin_api_bad"})

        integration.refresh_from_db()
        assert integration.metadata == {"api_key": "lin_api_old"}

    @responses.activate
    def test_update_organization_config_raises_when_stored_key_is_rejected(self) -> None:
        integration = self._create_integration()
        mock_linear(status=401, body=AUTHENTICATION_ERROR_RESPONSE)

        with pytest.raises(IntegrationConfigurationError, match="rejected the API key"):
            self._installation(integration).update_organization_config({})

    def test_update_organization_config_raises_when_not_configured(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="linear",
            external_id=str(self.organization.id),
            metadata={},
        )

        with pytest.raises(IntegrationConfigurationError, match="not configured"):
            self._installation(integration).update_organization_config({})

    def test_provider_is_single_install_and_flagged(self) -> None:
        provider = self.provider()
        assert provider.key == "linear"
        assert provider.name == "Linear for Seer"
        assert provider.allow_multiple is False
        assert provider.requires_feature_flag is True


@control_silo_test
class LinearApiPipelineTest(APITestCase):
    endpoint = "sentry-api-0-organization-pipeline"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def _initialize_pipeline(self) -> str:
        url = reverse(self.endpoint, args=[self.organization.slug, "integration_pipeline"])
        with self.feature("organizations:integrations-linear"):
            response = self.client.post(
                url, data={"action": "initialize", "provider": "linear"}, format="json"
            )
        assert response.status_code == 200
        assert response.data["step"] == "linear_credentials"
        return url

    @responses.activate
    def test_retry_after_rejected_api_key(self) -> None:
        url = self._initialize_pipeline()
        mock_linear(status=401, body=AUTHENTICATION_ERROR_RESPONSE)

        response = self.client.post(url, data={"apiKey": "lin_api_bad"}, format="json")

        assert response.status_code == 400
        assert response.data["data"]["detail"] == LINEAR_INVALID_API_KEY_MESSAGE
        assert not Integration.objects.filter(provider="linear").exists()

        response = self.client.get(url)
        assert response.status_code == 200
        assert response.data["step"] == "linear_credentials"
        assert response.data["stepIndex"] == 0

        responses.replace(
            responses.POST,
            LINEAR_GRAPHQL_URL,
            json={"data": {"organization": {"id": "ws", "name": "Example"}}},
        )
        response = self.client.post(url, data={"apiKey": "lin_api_corrected"}, format="json")

        assert response.status_code == 200
        assert response.data["status"] == "complete"
        integration = Integration.objects.get(
            provider="linear", external_id=str(self.organization.id)
        )
        assert integration.name == "Linear (Example)"
        assert integration.metadata == {"api_key": "lin_api_corrected"}
        assert OrganizationIntegration.objects.filter(
            organization_id=self.organization.id, integration_id=integration.id
        ).exists()
        assert len(responses.calls) == 2
        assert responses.calls[-1].request.headers["Authorization"] == "lin_api_corrected"

    def test_requires_feature_flag(self) -> None:
        url = reverse(self.endpoint, args=[self.organization.slug, "integration_pipeline"])

        response = self.client.post(
            url, data={"action": "initialize", "provider": "linear"}, format="json"
        )

        assert response.status_code == 404

    @responses.activate
    def test_settings_reject_invalid_api_key(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="linear",
            external_id=str(self.organization.id),
            name="Linear (Example)",
            metadata={"api_key": "lin_api_old"},
        )
        mock_linear(status=401, body=AUTHENTICATION_ERROR_RESPONSE)
        url = reverse(
            "sentry-api-0-organization-integration-details",
            args=[self.organization.slug, integration.id],
        )

        response = self.client.post(url, data={"api_key": "lin_api_bad"}, format="json")

        assert response.status_code == 400
        assert response.data["detail"] == LINEAR_INVALID_API_KEY_MESSAGE
        integration.refresh_from_db()
        assert integration.metadata == {"api_key": "lin_api_old"}
