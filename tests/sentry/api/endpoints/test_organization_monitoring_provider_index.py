from __future__ import annotations

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


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

    def test_list_shows_connected_datadog(self) -> None:
        idp = self.create_identity_provider(type="datadog", external_id="dd-org-456")
        identity = self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="dd-user-123",
            data={"access_token": "token"},
        )
        self.create_organization_identity(
            organization=self.organization,
            identity=identity,
        )

        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_success_response(self.organization.slug)

        providers = {p["provider"]: p for p in response.data["providers"]}
        assert providers["datadog"]["connected"] is True
        assert providers["gcp"]["connected"] is False

    def test_list_shows_connected_gcp(self) -> None:
        idp = self.create_identity_provider(type="gcp")
        identity = self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="google-user-123",
            data={"access_token": "token"},
        )
        self.create_organization_identity(
            organization=self.organization,
            identity=identity,
        )

        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_success_response(self.organization.slug)

        providers = {p["provider"]: p for p in response.data["providers"]}
        assert providers["gcp"] == {
            "provider": "gcp",
            "name": "Google Cloud Platform",
            "connected": True,
        }
        assert providers["datadog"] == {
            "provider": "datadog",
            "name": "Datadog",
            "connected": False,
        }

    def test_list_does_not_show_other_users_connections(self) -> None:
        other_user = self.create_user()
        self.create_member(organization=self.organization, user=other_user)

        idp = self.create_identity_provider(type="datadog", external_id="dd-org-456")
        identity = self.create_identity(
            user=other_user,
            identity_provider=idp,
            external_id="dd-user-456",
            data={"access_token": "token"},
        )
        self.create_organization_identity(
            organization=self.organization,
            identity=identity,
        )

        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_success_response(self.organization.slug)

        providers = {p["provider"]: p for p in response.data["providers"]}
        assert providers["datadog"]["connected"] is False
        assert providers["gcp"]["connected"] is False

    def test_cross_org_isolation(self) -> None:
        org2 = self.create_organization(name="other-org", owner=self.user)

        idp = self.create_identity_provider(type="datadog", external_id="dd-org-456")
        identity = self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="dd-user-123",
            data={"access_token": "token"},
        )
        self.create_organization_identity(
            organization=self.organization,
            identity=identity,
        )

        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_success_response(org2.slug)

        providers = {p["provider"]: p for p in response.data["providers"]}
        assert providers["datadog"]["connected"] is False
