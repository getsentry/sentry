from __future__ import annotations

from unittest.mock import MagicMock, patch

from django.http import HttpResponseRedirect
from requests.exceptions import HTTPError

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.models.identity import Identity, IdentityProvider, OrganizationIdentity


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

    @patch(
        "sentry.api.endpoints.organization_monitoring_provider_details.MonitoringIdentityPipeline.current_step"
    )
    @patch(
        "sentry.api.endpoints.organization_monitoring_provider_details.MonitoringIdentityPipeline.initialize"
    )
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

    @patch(
        "sentry.api.endpoints.organization_monitoring_provider_details.MonitoringIdentityPipeline.current_step"
    )
    @patch(
        "sentry.api.endpoints.organization_monitoring_provider_details.MonitoringIdentityPipeline.initialize"
    )
    def test_connect_gcp_creates_identity_provider(
        self, mock_initialize: MagicMock, mock_current_step: MagicMock
    ) -> None:
        mock_current_step.return_value = HttpResponseRedirect("https://accounts.google.com/")

        assert not IdentityProvider.objects.filter(type="gcp").exists()

        with self.feature("organizations:seer-infra-telemetry"):
            self.get_success_response(self.organization.slug, "gcp")

        assert IdentityProvider.objects.filter(type="gcp").exists()

    @patch(
        "sentry.api.endpoints.organization_monitoring_provider_details.MonitoringIdentityPipeline.current_step"
    )
    @patch(
        "sentry.api.endpoints.organization_monitoring_provider_details.MonitoringIdentityPipeline.initialize"
    )
    @patch(
        "sentry.api.endpoints.organization_monitoring_provider_details.MonitoringIdentityPipeline.__init__",
        return_value=None,
    )
    def test_connect_datadog_does_not_create_identity_provider(
        self, mock_init: MagicMock, mock_initialize: MagicMock, mock_current_step: MagicMock
    ) -> None:
        mock_current_step.return_value = HttpResponseRedirect(
            "https://mcp.datadoghq.com/api/unstable/mcp-server/authorize"
        )

        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_success_response(
                self.organization.slug, "datadog", site="datadoghq.com"
            )

        assert not IdentityProvider.objects.filter(type="datadog").exists()
        assert response.data["redirectUrl"].startswith("https://mcp.datadoghq.com/")

    def test_connect_datadog_requires_site(self) -> None:
        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_response(self.organization.slug, "datadog")

        assert response.status_code == 400
        assert "site" in response.data["detail"]

    def test_connect_datadog_invalid_site(self) -> None:
        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_response(self.organization.slug, "datadog", site="evil.example.com")

        assert response.status_code == 400
        assert "Invalid Datadog site" in response.data["detail"]

    def test_connect_unknown_provider(self) -> None:
        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_response(self.organization.slug, "unknown")

        assert response.status_code == 400
        assert "Unknown monitoring provider" in response.data["detail"]

    @patch(
        "sentry.api.endpoints.organization_monitoring_provider_details.MonitoringIdentityPipeline.current_step"
    )
    @patch(
        "sentry.api.endpoints.organization_monitoring_provider_details.MonitoringIdentityPipeline.initialize"
    )
    @patch(
        "sentry.api.endpoints.organization_monitoring_provider_details.MonitoringIdentityPipeline.__init__",
        return_value=None,
    )
    def test_connect_allowed_for_org_read_member(
        self, mock_init: MagicMock, mock_initialize: MagicMock, mock_current_step: MagicMock
    ) -> None:
        mock_current_step.return_value = HttpResponseRedirect(
            "https://mcp.datadoghq.com/api/unstable/mcp-server/authorize"
        )

        member_user = self.create_user()
        self.create_member(organization=self.organization, user=member_user, role="member")
        self.login_as(member_user)

        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_success_response(
                self.organization.slug, "datadog", site="datadoghq.com"
            )

        assert "redirectUrl" in response.data

    @patch("sentry.identity.datadog.provider.get_user_info")
    def test_connect_datadog_pat_links_identity(self, mock_get_user_info: MagicMock) -> None:
        mock_get_user_info.return_value = {
            "user_uuid": "dd-user-123",
            "org_uuid": "dd-org-456",
            "user_email": "user@example.com",
            "user_name": "Test User",
        }

        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_response(
                self.organization.slug, "datadog_pat", access_token="pat-abc", site="datadoghq.com"
            )

        assert response.status_code == 204

        idp = IdentityProvider.objects.get(type="datadog_pat", external_id="dd-org-456")
        identity = Identity.objects.get(idp=idp, user=self.user)
        assert identity.external_id == "dd-user-123"
        assert identity.data == {"access_token": "pat-abc", "site": "datadoghq.com"}

    @patch("sentry.identity.datadog.provider.get_user_info")
    def test_connect_datadog_pat_overwrites_existing_token(
        self, mock_get_user_info: MagicMock
    ) -> None:
        mock_get_user_info.return_value = {
            "user_uuid": "dd-user-123",
            "org_uuid": "dd-org-456",
        }

        with self.feature("organizations:seer-infra-telemetry"):
            self.get_success_response(
                self.organization.slug, "datadog_pat", access_token="pat-old", site="datadoghq.com"
            )
            self.get_success_response(
                self.organization.slug, "datadog_pat", access_token="pat-new", site="datadoghq.eu"
            )

        idp = IdentityProvider.objects.get(type="datadog_pat", external_id="dd-org-456")
        identity = Identity.objects.get(idp=idp, user=self.user)
        assert identity.data == {"access_token": "pat-new", "site": "datadoghq.eu"}

    @patch("sentry.identity.datadog.provider.get_user_info")
    def test_connect_datadog_pat_switch_account_via_reconnect(
        self, mock_get_user_info: MagicMock
    ) -> None:
        # Switching to a different Datadog user in the same Datadog org is done by
        # disconnecting first, then reconnecting.
        mock_get_user_info.side_effect = [
            {"user_uuid": "dd-user-1", "org_uuid": "dd-org-456"},
            {"user_uuid": "dd-user-2", "org_uuid": "dd-org-456"},
            {"user_uuid": "dd-user-2", "org_uuid": "dd-org-456"},
        ]

        with self.feature("organizations:seer-infra-telemetry"):
            # Connect the first Datadog account.
            self.get_success_response(
                self.organization.slug, "datadog_pat", access_token="pat-1", site="datadoghq.com"
            )
            # Connecting a different account in the same Datadog org conflicts.
            conflict = self.get_response(
                self.organization.slug, "datadog_pat", access_token="pat-2", site="datadoghq.com"
            )
            assert conflict.status_code == 409
            # Disconnect, then reconnect with the new account.
            self.get_success_response(
                self.organization.slug, "datadog_pat", method="delete", status_code=204
            )
            self.get_success_response(
                self.organization.slug, "datadog_pat", access_token="pat-2", site="datadoghq.com"
            )

        idp = IdentityProvider.objects.get(type="datadog_pat", external_id="dd-org-456")
        identity = Identity.objects.get(idp=idp, user=self.user)
        assert identity.external_id == "dd-user-2"
        assert identity.data == {"access_token": "pat-2", "site": "datadoghq.com"}

    def test_connect_datadog_pat_requires_access_token(self) -> None:
        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_response(
                self.organization.slug, "datadog_pat", site="datadoghq.com"
            )

        assert response.status_code == 400
        assert "access_token" in response.data["detail"]

    def test_connect_datadog_pat_requires_site(self) -> None:
        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_response(
                self.organization.slug, "datadog_pat", access_token="pat-abc"
            )

        assert response.status_code == 400
        assert "site" in response.data["detail"]

    def test_connect_datadog_pat_invalid_site(self) -> None:
        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_response(
                self.organization.slug,
                "datadog_pat",
                access_token="pat-abc",
                site="evil.example.com",
            )

        assert response.status_code == 400
        assert "Invalid Datadog site" in response.data["detail"]

    @patch("sentry.identity.datadog.provider.get_user_info", side_effect=HTTPError())
    def test_connect_datadog_pat_provider_error(self, mock_get_user_info: MagicMock) -> None:
        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_response(
                self.organization.slug, "datadog_pat", access_token="pat-abc", site="datadoghq.com"
            )

        assert response.status_code == 400
        assert "Failed to verify token" in response.data["detail"]
        assert not IdentityProvider.objects.filter(type="datadog_pat").exists()

    @patch("sentry.identity.datadog.provider.get_user_info")
    def test_connect_datadog_pat_already_connected(self, mock_get_user_info: MagicMock) -> None:
        mock_get_user_info.return_value = {
            "user_uuid": "dd-user-123",
            "org_uuid": "dd-org-456",
        }

        other_user = self.create_user()
        idp = self.create_identity_provider(type="datadog_pat", external_id="dd-org-456")
        self.create_identity(
            user=other_user,
            identity_provider=idp,
            external_id="dd-user-123",
            data={"access_token": "other-tok", "site": "datadoghq.com"},
        )

        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_response(
                self.organization.slug, "datadog_pat", access_token="pat-abc", site="datadoghq.com"
            )

        assert response.status_code == 409
        assert "already connected" in response.data["detail"]
        # The other user's identity is preserved.
        assert Identity.objects.get(idp=idp, external_id="dd-user-123").user_id == other_user.id
        assert not Identity.objects.filter(idp=idp, user=self.user).exists()


@control_silo_test
class OrganizationMonitoringProviderDetailsDisconnectTest(APITestCase):
    endpoint = "sentry-api-0-organization-monitoring-provider-details"
    method = "delete"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def test_disconnect_requires_feature_flag(self) -> None:
        response = self.get_response(self.organization.slug, "datadog")
        assert response.status_code == 404

    def test_disconnect_deletes_identity_datadog(self) -> None:
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
            response = self.get_response(self.organization.slug, "datadog")

        assert response.status_code == 204
        assert not OrganizationIdentity.objects.filter(
            organization_id=self.organization.id, identity=identity
        ).exists()
        assert not Identity.objects.filter(id=identity.id).exists()

    def test_disconnect_deletes_identity_datadog_pat(self) -> None:
        idp = self.create_identity_provider(type="datadog_pat", external_id="dd-org-456")
        identity = self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="dd-user-123",
            data={"access_token": "pat-abc", "site": "datadoghq.com"},
        )
        self.create_organization_identity(
            organization=self.organization,
            identity=identity,
        )

        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_response(self.organization.slug, "datadog_pat")

        assert response.status_code == 204
        assert not OrganizationIdentity.objects.filter(
            organization_id=self.organization.id, identity=identity
        ).exists()
        assert not Identity.objects.filter(id=identity.id).exists()

    def test_disconnect_deletes_identity_gcp(self) -> None:
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
            response = self.get_response(self.organization.slug, "gcp")

        assert response.status_code == 204
        assert not OrganizationIdentity.objects.filter(
            organization_id=self.organization.id, identity=identity
        ).exists()
        assert not Identity.objects.filter(id=identity.id).exists()

    def test_disconnect_only_affects_requesting_user(self) -> None:
        other_user = self.create_user()
        self.create_member(organization=self.organization, user=other_user)

        idp = self.create_identity_provider(type="datadog", external_id="dd-org-456")
        my_identity = self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="dd-user-123",
            data={"access_token": "token-a"},
        )
        other_identity = self.create_identity(
            user=other_user,
            identity_provider=idp,
            external_id="dd-user-456",
            data={"access_token": "token-b"},
        )
        self.create_organization_identity(
            organization=self.organization,
            identity=my_identity,
        )
        self.create_organization_identity(
            organization=self.organization,
            identity=other_identity,
        )

        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_response(self.organization.slug, "datadog")

        assert response.status_code == 204
        assert not OrganizationIdentity.objects.filter(
            organization_id=self.organization.id, identity=my_identity
        ).exists()
        assert OrganizationIdentity.objects.filter(
            organization_id=self.organization.id, identity=other_identity
        ).exists()
        assert Identity.objects.filter(id=other_identity.id).exists()

    def test_disconnect_preserves_identity_when_other_org_references_it(self) -> None:
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
        self.create_organization_identity(
            organization=org2,
            identity=identity,
        )

        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_response(self.organization.slug, "datadog")

        assert response.status_code == 204
        assert not OrganizationIdentity.objects.filter(
            organization_id=self.organization.id, identity=identity
        ).exists()
        assert Identity.objects.filter(id=identity.id).exists()
        assert OrganizationIdentity.objects.filter(
            organization_id=org2.id, identity=identity
        ).exists()

    def test_disconnect_unknown_provider(self) -> None:
        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_response(self.organization.slug, "unknown")

        assert response.status_code == 400
        assert "Unknown monitoring provider" in response.data["detail"]

    def test_disconnect_not_connected(self) -> None:
        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_response(self.organization.slug, "datadog")

        assert response.status_code == 404
        assert "Not connected to this provider" in response.data["detail"]

    def test_disconnect_allowed_for_org_read_member(self) -> None:
        member_user = self.create_user()
        self.create_member(organization=self.organization, user=member_user, role="member")

        idp = self.create_identity_provider(type="datadog", external_id="dd-org-789")
        identity = self.create_identity(
            user=member_user,
            identity_provider=idp,
            external_id="dd-user-789",
            data={"access_token": "token"},
        )
        self.create_organization_identity(
            organization=self.organization,
            identity=identity,
        )

        self.login_as(member_user)

        with self.feature("organizations:seer-infra-telemetry"):
            response = self.get_response(self.organization.slug, "datadog")

        assert response.status_code == 204
        assert not OrganizationIdentity.objects.filter(
            organization_id=self.organization.id, identity=identity
        ).exists()
