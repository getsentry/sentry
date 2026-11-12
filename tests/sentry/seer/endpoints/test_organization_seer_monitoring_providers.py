from time import time

import responses
from cryptography.fernet import Fernet
from django.test import override_settings
from django.urls import reverse

from sentry.integrations.linear.client import LINEAR_TOKEN_URL
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import cell_silo_test
from sentry.viewer_context import Actor, ActorType, ViewerContext, encode_viewer_context

VIEWER_CONTEXT_SECRET = "test-seer-api-shared-secret-thirty-two-bytes!"
TEST_FERNET_KEY = Fernet.generate_key().decode("utf-8")
DATADOG_TOKEN_URL = "https://mcp.datadoghq.com/api/unstable/mcp-server/token"


def _decrypt(value: str) -> str:
    return Fernet(TEST_FERNET_KEY.encode()).decrypt(value.encode()).decode()


FEATURES = {
    "organizations:seer-infra-telemetry": True,
    "organizations:seer-infra-telemetry-user-level-auth": True,
    "organizations:service-accounts": True,
}


class SeerMonitoringProviderEndpointTestBase(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.member = self.create_user()
        self.create_member(organization=self.organization, user=self.member, role="member")
        idp = self.create_identity_provider(type="datadog", external_id="dd-org")
        self.identity = self.create_identity(
            user=self.member,
            identity_provider=idp,
            external_id="dd-member",
            data={
                "access_token": "personal-token",
                "refresh_token": "refresh-token",
                "client_id": "dcr-cid",
                "client_secret": "dcr-csec",
                "site": "datadoghq.com",
                "expires": int(time()) + 3600,
            },
        )
        self.create_organization_identity(organization=self.organization, identity=self.identity)
        self.create_integration(
            organization=self.organization,
            provider="datadog",
            external_id="dd-org-uuid",
            metadata={"api_key": "org-api-key", "app_key": "org-app-key", "site": "datadoghq.com"},
        )

    def _user_header(self, user_id: int) -> str:
        return encode_viewer_context(
            ViewerContext(
                actor=Actor(type=ActorType.USER, actor_id=user_id),
                organization_id=self.organization.id,
            ),
            key=VIEWER_CONTEXT_SECRET,
        )

    def _service_account_header(self, scopes: list[str]) -> str:
        service_account = self.create_service_account(
            organization=self.organization, scope_list=scopes
        )
        return encode_viewer_context(
            ViewerContext(
                actor=Actor(type=ActorType.SERVICE_ACCOUNT, actor_id=service_account.id),
                organization_id=self.organization.id,
            ),
            key=VIEWER_CONTEXT_SECRET,
        )


@override_settings(
    SEER_API_SHARED_SECRET=VIEWER_CONTEXT_SECRET, SEER_GHE_ENCRYPT_KEY=TEST_FERNET_KEY
)
@with_feature(FEATURES)
@cell_silo_test
class TestOrganizationSeerMonitoringConnections(SeerMonitoringProviderEndpointTestBase):
    def _url(self) -> str:
        return reverse(
            "sentry-api-0-organization-seer-monitoring-connections",
            args=[self.organization.slug],
        )

    def test_user_gets_personal_identity_over_org_integration(self) -> None:
        response = self.client.get(
            self._url(), HTTP_X_VIEWER_CONTEXT=self._user_header(self.member.id)
        )

        assert response.status_code == 200, response.content
        [connection] = response.data["connections"]
        assert connection["identity_id"] == self.identity.id
        assert (
            _decrypt(connection["encrypted_auth_headers"]["Authorization"])
            == "Bearer personal-token"
        )

    def test_service_account_gets_org_integration_only(self) -> None:
        response = self.client.get(
            self._url(), HTTP_X_VIEWER_CONTEXT=self._service_account_header(["seer:write"])
        )

        assert response.status_code == 200, response.content
        [connection] = response.data["connections"]
        assert connection["identity_id"] is None
        assert connection["auth_method"] == "api_key"
        assert _decrypt(connection["encrypted_auth_headers"]["DD-API-KEY"]) == "org-api-key"

    def test_service_account_without_seer_write_is_denied(self) -> None:
        response = self.client.get(
            self._url(), HTTP_X_VIEWER_CONTEXT=self._service_account_header(["seer:read"])
        )

        assert response.status_code == 403

    def test_session_is_rejected(self) -> None:
        self.login_as(self.member)

        response = self.client.get(self._url())

        assert response.status_code == 403
        assert response.data["detail"] == "Authentication credentials were not provided."

    def test_non_member_is_denied(self) -> None:
        outsider = self.create_user()

        response = self.client.get(
            self._url(), HTTP_X_VIEWER_CONTEXT=self._user_header(outsider.id)
        )

        assert response.status_code == 403


@override_settings(
    SEER_API_SHARED_SECRET=VIEWER_CONTEXT_SECRET, SEER_GHE_ENCRYPT_KEY=TEST_FERNET_KEY
)
@with_feature(FEATURES)
@cell_silo_test
class TestOrganizationSeerMonitoringIdentityToken(SeerMonitoringProviderEndpointTestBase):
    def _url(self, identity_id: int) -> str:
        return reverse(
            "sentry-api-0-organization-seer-monitoring-identity-token",
            args=[self.organization.slug, identity_id],
        )

    @responses.activate
    def test_refreshes_own_identity(self) -> None:
        responses.add(
            responses.POST,
            DATADOG_TOKEN_URL,
            json={"access_token": "new-token", "refresh_token": "new-refresh", "expires_in": 3600},
        )

        response = self.client.post(
            self._url(self.identity.id), HTTP_X_VIEWER_CONTEXT=self._user_header(self.member.id)
        )

        assert response.status_code == 200, response.content
        assert (
            _decrypt(response.data["encrypted_auth_headers"]["Authorization"]) == "Bearer new-token"
        )

    @responses.activate
    def test_cannot_refresh_another_users_identity(self) -> None:
        other = self.create_user()
        self.create_member(organization=self.organization, user=other, role="member")

        response = self.client.post(
            self._url(self.identity.id), HTTP_X_VIEWER_CONTEXT=self._user_header(other.id)
        )

        assert response.status_code == 404
        assert response.data == {"detail": "identity_not_found"}
        assert len(responses.calls) == 0

    @responses.activate
    def test_cannot_refresh_identity_connected_to_another_organization(self) -> None:
        other_org = self.create_organization(owner=self.member)
        other_idp = self.create_identity_provider(type="datadog", external_id="dd-other-org")
        other_identity = self.create_identity(
            user=self.member,
            identity_provider=other_idp,
            external_id="dd-member-other-org",
            data={**self.identity.data, "access_token": "other-org-token"},
        )
        self.create_organization_identity(organization=other_org, identity=other_identity)
        responses.add(
            responses.POST,
            DATADOG_TOKEN_URL,
            json={"access_token": "new-token", "refresh_token": "new-refresh", "expires_in": 3600},
        )

        response = self.client.post(
            self._url(other_identity.id), HTTP_X_VIEWER_CONTEXT=self._user_header(self.member.id)
        )

        assert response.status_code == 404, response.content
        assert response.data == {"detail": "identity_not_found"}
        assert len(responses.calls) == 0

    @responses.activate
    def test_requires_user_level_auth_feature(self) -> None:
        with self.feature({"organizations:seer-infra-telemetry-user-level-auth": False}):
            response = self.client.post(
                self._url(self.identity.id),
                HTTP_X_VIEWER_CONTEXT=self._user_header(self.member.id),
            )

        assert response.status_code == 404
        assert len(responses.calls) == 0

    @responses.activate
    def test_provider_failure_is_bad_gateway(self) -> None:
        responses.add(responses.POST, DATADOG_TOKEN_URL, status=500)

        response = self.client.post(
            self._url(self.identity.id), HTTP_X_VIEWER_CONTEXT=self._user_header(self.member.id)
        )

        assert response.status_code == 502
        assert response.data == {"detail": "refresh_failed"}

    @responses.activate
    def test_service_account_requires_user(self) -> None:
        response = self.client.post(
            self._url(self.identity.id),
            HTTP_X_VIEWER_CONTEXT=self._service_account_header(["seer:write"]),
        )

        assert response.status_code == 403
        assert response.data["detail"]["code"] == "user-required"
        assert len(responses.calls) == 0


@override_settings(
    SEER_API_SHARED_SECRET=VIEWER_CONTEXT_SECRET,
    SEER_GHE_ENCRYPT_KEY=TEST_FERNET_KEY,
    LINEAR_CLIENT_ID="sentry-app-id",
    LINEAR_CLIENT_SECRET="sentry-app-secret",
)
@with_feature(FEATURES)
@cell_silo_test
class TestOrganizationSeerMonitoringIntegrationToken(SeerMonitoringProviderEndpointTestBase):
    def setUp(self) -> None:
        super().setUp()
        self.linear = self.create_integration(
            organization=self.organization,
            provider="linear",
            external_id="linear-workspace-id",
            metadata={"refresh_token": "linear-refresh-token"},
        )

    def _url(self, integration_id: int) -> str:
        return reverse(
            "sentry-api-0-organization-seer-monitoring-integration-token",
            args=[self.organization.slug, integration_id],
        )

    @responses.activate
    def test_service_account_refreshes_org_integration(self) -> None:
        responses.add(
            responses.POST,
            LINEAR_TOKEN_URL,
            json={
                "access_token": "new-app-token",
                "refresh_token": "new-refresh-token",
                "token_type": "Bearer",
                "scope": "read write",
                "expires_in": 3600,
            },
        )

        response = self.client.post(
            self._url(self.linear.id),
            HTTP_X_VIEWER_CONTEXT=self._service_account_header(["seer:write"]),
        )

        assert response.status_code == 200, response.content
        assert (
            _decrypt(response.data["encrypted_auth_headers"]["Authorization"])
            == "Bearer new-app-token"
        )
        assert "new-refresh-token" not in response.content.decode()

    @responses.activate
    def test_cannot_refresh_another_organizations_integration(self) -> None:
        other_org = self.create_organization(owner=self.user)
        other_linear = self.create_integration(
            organization=other_org, provider="linear", external_id="other-linear"
        )

        response = self.client.post(
            self._url(other_linear.id), HTTP_X_VIEWER_CONTEXT=self._user_header(self.member.id)
        )

        assert response.status_code == 404
        assert response.data == {"detail": "integration_not_found"}
        assert len(responses.calls) == 0

    @responses.activate
    def test_requires_feature(self) -> None:
        with self.feature({"organizations:seer-infra-telemetry": False}):
            response = self.client.post(
                self._url(self.linear.id),
                HTTP_X_VIEWER_CONTEXT=self._service_account_header(["seer:write"]),
            )

        assert response.status_code == 404
        assert len(responses.calls) == 0
