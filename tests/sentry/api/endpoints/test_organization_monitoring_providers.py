from __future__ import annotations

from unittest.mock import MagicMock, patch

from django.http import HttpResponseRedirect

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.models.identity import Identity, IdentityProvider


@control_silo_test
class OrganizationMonitoringProviderIndexEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-monitoring-providers"
    method = "get"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def test_list_requires_feature_flag(self) -> None:
        response = self.get_response(self.organization.slug)
        assert response.status_code == 404

    def test_list_providers(self) -> None:
        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_success_response(self.organization.slug)

        providers = {p["provider"]: p for p in response.data["providers"]}
        assert "gcp" in providers
        assert "datadog" in providers
        assert providers["gcp"]["name"] == "Google Cloud Platform"
        assert providers["datadog"]["name"] == "Datadog"
        assert providers["gcp"]["connected"] is False
        assert providers["datadog"]["connected"] is False

    def test_list_shows_connected_provider(self) -> None:
        idp = self.create_identity_provider(type="gcp")
        self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="google-user-123",
            data={"email": "user@example.com", "access_token": "token"},
        )

        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_success_response(self.organization.slug)

        providers = {p["provider"]: p for p in response.data["providers"]}
        assert providers["gcp"] == {
            "provider": "gcp",
            "name": "Google Cloud Platform",
            "connected": True,
            "email": "user@example.com",
        }
        assert providers["datadog"] == {
            "provider": "datadog",
            "name": "Datadog",
            "connected": False,
        }

    def test_list_connected_without_email(self) -> None:
        idp = self.create_identity_provider(type="datadog", external_id="datadoghq.com")
        self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="dd-user-123",
            data={"access_token": "token"},
        )

        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_success_response(self.organization.slug)

        providers = {p["provider"]: p for p in response.data["providers"]}
        assert providers["datadog"]["connected"] is True
        assert "email" not in providers["datadog"]

    def test_list_does_not_show_other_users_connections(self) -> None:
        other_user = self.create_user()
        self.create_member(organization=self.organization, user=other_user)

        idp = self.create_identity_provider(type="gcp")
        self.create_identity(
            user=other_user,
            identity_provider=idp,
            external_id="other-google-user-456",
            data={"email": "other@example.com", "access_token": "token"},
        )

        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_success_response(self.organization.slug)

        providers = {p["provider"]: p for p in response.data["providers"]}
        assert providers["gcp"]["connected"] is False
        assert providers["datadog"]["connected"] is False


@control_silo_test
class OrganizationMonitoringProviderDetailsConnectTest(APITestCase):
    endpoint = "sentry-api-0-organization-monitoring-provider-details"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def test_connect_requires_feature_flag(self) -> None:
        response = self.get_response(self.organization.slug, "datadog")
        assert response.status_code == 404

    @patch("sentry.identity.pipeline.IdentityPipeline.current_step")
    @patch("sentry.identity.pipeline.IdentityPipeline.initialize")
    def test_connect_returns_redirect_url(
        self, mock_initialize: MagicMock, mock_current_step: MagicMock
    ) -> None:
        mock_current_step.return_value = HttpResponseRedirect(
            "https://accounts.google.com/o/oauth2/v2/auth?client_id=test"
        )

        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_success_response(self.organization.slug, "gcp")

        assert "redirectUrl" in response.data
        assert response.data["redirectUrl"].startswith("https://accounts.google.com/")
        mock_initialize.assert_called_once()

    @patch("sentry.identity.pipeline.IdentityPipeline.current_step")
    @patch("sentry.identity.pipeline.IdentityPipeline.initialize")
    def test_connect_gcp_creates_identity_provider(
        self, mock_initialize: MagicMock, mock_current_step: MagicMock
    ) -> None:
        mock_current_step.return_value = HttpResponseRedirect("https://accounts.google.com/")

        assert not IdentityProvider.objects.filter(type="gcp").exists()

        with self.feature("organizations:seer-infra-telemetry"):
            self.get_success_response(self.organization.slug, "gcp")

        assert IdentityProvider.objects.filter(type="gcp").exists()

    @patch("sentry.api.endpoints.organization_monitoring_providers.IdentityPipeline.current_step")
    @patch("sentry.api.endpoints.organization_monitoring_providers.IdentityPipeline.initialize")
    @patch(
        "sentry.api.endpoints.organization_monitoring_providers.IdentityPipeline.__init__",
        return_value=None,
    )
    def test_connect_datadog_creates_identity_provider(
        self, mock_init: MagicMock, mock_initialize: MagicMock, mock_current_step: MagicMock
    ) -> None:
        mock_current_step.return_value = HttpResponseRedirect(
            "https://mcp.datadoghq.com/api/unstable/mcp-server/authorize"
        )

        assert not IdentityProvider.objects.filter(type="datadog").exists()

        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_success_response(
                self.organization.slug, "datadog", site="datadoghq.com"
            )

        assert IdentityProvider.objects.filter(type="datadog", external_id="datadoghq.com").exists()
        assert response.data["redirectUrl"].startswith("https://mcp.datadoghq.com/")

    def test_connect_datadog_requires_site(self) -> None:
        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_response(self.organization.slug, "datadog")

        assert response.status_code == 400
        assert "site" in response.data["detail"]

    def test_connect_unknown_provider(self) -> None:
        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_response(self.organization.slug, "unknown")

        assert response.status_code == 400


@control_silo_test
class OrganizationMonitoringProviderDetailsDisconnectTest(APITestCase):
    endpoint = "sentry-api-0-organization-monitoring-provider-details"
    method = "delete"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def test_disconnect_requires_feature_flag(self) -> None:
        response = self.get_response(self.organization.slug, "gcp")
        assert response.status_code == 404

    def test_disconnect_deletes_identity_datadog(self) -> None:
        idp = self.create_identity_provider(type="datadog", external_id="datadoghq.com")
        self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="dd-user-123",
            data={"access_token": "token"},
        )

        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_response(self.organization.slug, "datadog")

        assert response.status_code == 204
        assert not Identity.objects.filter(idp=idp, user=self.user).exists()

    def test_disconnect_deletes_identity_gcp(self) -> None:
        idp = self.create_identity_provider(type="gcp")
        self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="google-user-123",
            data={"access_token": "token"},
        )

        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_response(self.organization.slug, "gcp")

        assert response.status_code == 204
        assert not Identity.objects.filter(idp=idp, user=self.user).exists()

    def test_disconnect_only_affects_requesting_user(self) -> None:
        other_user = self.create_user()
        self.create_member(organization=self.organization, user=other_user)

        idp = self.create_identity_provider(type="gcp")
        self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="google-user-123",
            data={"access_token": "token-a"},
        )
        other_identity = self.create_identity(
            user=other_user,
            identity_provider=idp,
            external_id="google-user-456",
            data={"access_token": "token-b"},
        )

        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_response(self.organization.slug, "gcp")

        assert response.status_code == 204
        assert not Identity.objects.filter(idp=idp, user=self.user).exists()
        assert Identity.objects.filter(id=other_identity.id).exists()

    def test_disconnect_unknown_provider(self) -> None:
        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_response(self.organization.slug, "unknown")

        assert response.status_code == 400

    def test_disconnect_not_connected(self) -> None:
        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_response(self.organization.slug, "gcp")

        assert response.status_code == 404
