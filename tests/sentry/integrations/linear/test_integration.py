from typing import Any
from urllib.parse import parse_qs, urlparse

import pytest
import responses
from django.test import override_settings
from django.urls import reverse
from responses import matchers

from sentry.constants import ObjectStatus
from sentry.integrations.linear.client import (
    LINEAR_AUTHORIZATION_ERROR_MESSAGE,
    LINEAR_GRAPHQL_URL,
    LINEAR_REVOKE_URL,
    LINEAR_TOKEN_URL,
)
from sentry.integrations.linear.integration import LinearIntegration, LinearIntegrationProvider
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.shared_integrations.exceptions import IntegrationConfigurationError
from sentry.testutils.cases import APITestCase, IntegrationTestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import control_silo_test

WORKSPACE = {"id": "ws", "name": "Example", "app_user_id": "app-user-id"}
TOKEN_METADATA = {
    "access_token": "app-token",
    "refresh_token": "app-refresh-token",
    "expires_at": "2025-01-02T00:00:00+00:00",
    "scopes": ["read", "write"],
}
METADATA = {"workspace_id": "ws", "app_user_id": "app-user-id", **TOKEN_METADATA}


def mock_linear(
    *, access_token: str = "app-token", refresh_token: str = "app-refresh-token"
) -> None:
    responses.add(
        responses.POST,
        LINEAR_TOKEN_URL,
        json={
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_in": 86400,
            "token_type": "Bearer",
            "scope": "read write",
        },
    )
    responses.add(
        responses.POST,
        LINEAR_GRAPHQL_URL,
        json={
            "data": {
                "organization": {"id": "ws", "name": "Example"},
                "viewer": {"id": "app-user-id"},
            }
        },
    )


@control_silo_test
class LinearIntegrationProviderTest(IntegrationTestCase):
    provider = LinearIntegrationProvider

    def _create_integration(self) -> Integration:
        return self.create_integration(
            organization=self.organization,
            provider="linear",
            external_id="ws",
            name="Linear (Example)",
            metadata=METADATA.copy(),
        )

    def _installation(self, integration: Integration) -> LinearIntegration:
        installation = integration.get_installation(organization_id=self.organization.id)
        assert isinstance(installation, LinearIntegration)
        return installation

    def test_build_integration_stores_workspace_grant(self) -> None:
        provider = self.provider()
        provider.set_pipeline(self.pipeline)
        result = provider.build_integration(
            {"oauth_data": {"workspace": WORKSPACE, "token": TOKEN_METADATA}}
        )
        assert result["external_id"] == "ws"
        assert result["name"] == "Linear (Example)"
        assert result["metadata"] == METADATA

    def test_build_integration_requires_authorization(self) -> None:
        with pytest.raises(IntegrationConfigurationError, match="Missing Linear authorization"):
            self.provider().build_integration({})

    def test_settings_do_not_expose_or_accept_credentials(self) -> None:
        integration = self._create_integration()
        installation = self._installation(integration)
        assert installation.get_organization_config() == []
        assert installation.get_config_data() == {}
        with pytest.raises(IntegrationConfigurationError, match="Reconnect Linear"):
            installation.update_organization_config({"client_secret": "customer-secret"})
        integration.refresh_from_db()
        assert integration.metadata == METADATA
        assert OrganizationIntegration.objects.get(integration=integration).config == {}

    @responses.activate
    def test_uninstall_revokes_and_clears_last_workspace_grant(self) -> None:
        integration = self._create_integration()
        responses.add(
            responses.POST,
            LINEAR_REVOKE_URL,
            match=[
                matchers.urlencoded_params_matcher(
                    {"token": "app-refresh-token", "token_type_hint": "refresh_token"}
                )
            ],
            status=200,
        )

        self._installation(integration).uninstall()

        integration.refresh_from_db()
        assert len(responses.calls) == 1
        assert integration.status == ObjectStatus.DISABLED
        assert integration.metadata == {
            "workspace_id": "ws",
            "app_user_id": "app-user-id",
            "scopes": ["read", "write"],
        }

    @responses.activate
    def test_uninstall_preserves_grant_used_by_another_organization(self) -> None:
        integration = self._create_integration()
        integration.add_organization(self.create_organization())

        self._installation(integration).uninstall()

        integration.refresh_from_db()
        assert integration.metadata == METADATA
        assert integration.status == ObjectStatus.ACTIVE
        assert len(responses.calls) == 0

    @responses.activate
    def test_uninstall_ignores_organizations_pending_deletion(self) -> None:
        integration = self._create_integration()
        other_link = integration.add_organization(self.create_organization())
        assert other_link is not None
        other_link.update(status=ObjectStatus.PENDING_DELETION)
        responses.add(responses.POST, LINEAR_REVOKE_URL, status=400)

        self._installation(integration).uninstall()

        integration.refresh_from_db()
        assert "refresh_token" not in integration.metadata
        assert len(responses.calls) == 1

    @responses.activate
    def test_revoke_failure_does_not_block_uninstall(self) -> None:
        integration = self._create_integration()
        responses.add(responses.POST, LINEAR_REVOKE_URL, status=503)

        self._installation(integration).uninstall()

        assert len(responses.calls) == 1


@override_settings(LINEAR_CLIENT_ID="sentry-app-id", LINEAR_CLIENT_SECRET="sentry-app-secret")
@control_silo_test
@freeze_time("2025-01-01T00:00:00Z")
class LinearApiPipelineTest(APITestCase):
    endpoint = "sentry-api-0-organization-pipeline"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def _initialize_pipeline(self, organization_slug: str | None = None) -> tuple[str, str]:
        url = reverse(
            self.endpoint,
            args=[organization_slug or self.organization.slug, "integration_pipeline"],
        )
        with self.feature("organizations:integrations-linear"):
            response = self.client.post(
                url, data={"action": "initialize", "provider": "linear"}, format="json"
            )
        assert response.status_code == 200
        assert response.data["step"] == "oauth_login"
        return url, response.data["data"]["oauthUrl"]

    def _authorize(self, url: str, oauth_url: str) -> Any:
        state = parse_qs(urlparse(oauth_url).query)["state"][0]
        return self.client.post(url, data={"code": "linear-code", "state": state}, format="json")

    def test_requests_read_write_workspace_app_authorization(self) -> None:
        _, oauth_url = self._initialize_pipeline()
        parsed = urlparse(oauth_url)
        assert f"{parsed.scheme}://{parsed.netloc}{parsed.path}" == (
            "https://linear.app/oauth/authorize"
        )
        params = parse_qs(parsed.query)
        assert params["client_id"] == ["sentry-app-id"]
        assert params["scope"] == ["read,write"]
        assert params["actor"] == ["app"]
        assert params["prompt"] == ["consent"]
        assert params["response_type"] == ["code"]
        assert urlparse(params["redirect_uri"][0]).path == "/extensions/linear/setup/"
        assert params["state"][0]
        assert "sentry-app-secret" not in oauth_url

    def test_connection_details_do_not_expose_credentials(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="linear",
            external_id="ws",
            metadata=METADATA.copy(),
        )
        response = self.client.get(
            reverse(
                "sentry-api-0-organization-integration-details",
                args=[self.organization.slug, integration.id],
            )
        )

        assert response.status_code == 200
        assert response.data["configOrganization"] == []
        assert response.data["configData"] == {}
        assert response.data["dynamicDisplayInformation"]["configure_integration"][
            "instructions"
        ] == [
            "Seer has read and write access to this Linear workspace. "
            "Reconnect Linear to update its authorization."
        ]
        assert "app-token" not in response.content.decode()
        assert "app-refresh-token" not in response.content.decode()
        assert "sentry-app-secret" not in response.content.decode()

    @responses.activate
    def test_installs_workspace_grant_without_personal_identity(self) -> None:
        url, oauth_url = self._initialize_pipeline()
        mock_linear()
        responses.replace(
            responses.POST,
            LINEAR_TOKEN_URL,
            match=[
                matchers.urlencoded_params_matcher(
                    {
                        "grant_type": "authorization_code",
                        "code": "linear-code",
                        "client_id": "sentry-app-id",
                        "client_secret": "sentry-app-secret",
                        "redirect_uri": parse_qs(urlparse(oauth_url).query)["redirect_uri"][0],
                    }
                )
            ],
            json={
                "access_token": "app-token",
                "refresh_token": "app-refresh-token",
                "expires_in": 86400,
                "token_type": "Bearer",
                "scope": "read write",
            },
        )

        response = self._authorize(url, oauth_url)

        assert response.status_code == 200
        assert response.data["status"] == "complete"
        integration = Integration.objects.get(provider="linear", external_id="ws")
        assert integration.name == "Linear (Example)"
        assert integration.metadata == METADATA
        org_integration = OrganizationIntegration.objects.get(
            organization_id=self.organization.id, integration_id=integration.id
        )
        assert org_integration.default_auth_id is None
        assert responses.calls[1].request.headers["Authorization"] == "Bearer app-token"
        assert "app-token" not in response.content.decode()
        assert "app-refresh-token" not in response.content.decode()
        assert "sentry-app-secret" not in response.content.decode()

    @responses.activate
    def test_invalid_state_does_not_exchange_tokens(self) -> None:
        url, _ = self._initialize_pipeline()
        response = self.client.post(
            url, data={"code": "linear-code", "state": "wrong-state"}, format="json"
        )
        assert response.status_code == 400
        assert len(responses.calls) == 0
        assert not Integration.objects.filter(provider="linear").exists()

    @responses.activate
    def test_retry_after_rejected_authorization(self) -> None:
        url, oauth_url = self._initialize_pipeline()
        responses.add(responses.POST, LINEAR_TOKEN_URL, status=400)
        response = self._authorize(url, oauth_url)
        assert response.status_code == 400
        assert response.data["data"]["detail"] == LINEAR_AUTHORIZATION_ERROR_MESSAGE
        assert not Integration.objects.filter(provider="linear").exists()
        response = self.client.get(url)
        assert response.data["step"] == "oauth_login"
        assert response.data["stepIndex"] == 0

        responses.reset()
        mock_linear()
        response = self._authorize(url, oauth_url)
        assert response.status_code == 200
        assert response.data["status"] == "complete"

    @responses.activate
    def test_rejected_workspace_does_not_install(self) -> None:
        url, oauth_url = self._initialize_pipeline()
        mock_linear()
        responses.replace(responses.POST, LINEAR_GRAPHQL_URL, status=403)
        response = self._authorize(url, oauth_url)
        assert response.status_code == 400
        assert not Integration.objects.filter(provider="linear").exists()

    @responses.activate
    def test_callback_uses_existing_pipeline_trampoline(self) -> None:
        _, oauth_url = self._initialize_pipeline()
        response = self.client.get(
            "/extensions/linear/setup/",
            data={"code": "linear-code", "state": parse_qs(urlparse(oauth_url).query)["state"][0]},
        )
        assert response.status_code == 200
        assert b"window.opener.postMessage" in response.content
        assert b"linear-code" in response.content
        assert len(responses.calls) == 0

    @responses.activate
    def test_authorizations_share_workspace_token_rotation_across_sentry_organizations(
        self,
    ) -> None:
        url, oauth_url = self._initialize_pipeline()
        mock_linear()
        assert self._authorize(url, oauth_url).status_code == 200
        integration = Integration.objects.get(provider="linear")

        other_organization = self.create_organization(owner=self.user)
        url, oauth_url = self._initialize_pipeline(other_organization.slug)
        responses.reset()
        mock_linear(access_token="replacement-token", refresh_token="replacement-refresh-token")
        assert self._authorize(url, oauth_url).status_code == 200

        assert Integration.objects.filter(provider="linear").count() == 1
        assert OrganizationIntegration.objects.filter(integration=integration).count() == 2
        integration.refresh_from_db()
        assert integration.metadata["refresh_token"] == "replacement-refresh-token"
        assert integration.metadata["access_token"] == "replacement-token"

    @responses.activate
    def test_reauthorization_reactivates_disabled_grant(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="linear",
            external_id="ws",
            metadata=METADATA.copy(),
            status=ObjectStatus.DISABLED,
        )
        url, oauth_url = self._initialize_pipeline()
        mock_linear(access_token="replacement-token", refresh_token="replacement-refresh-token")

        assert self._authorize(url, oauth_url).status_code == 200

        integration.refresh_from_db()
        assert integration.status == ObjectStatus.ACTIVE
        assert integration.metadata["refresh_token"] == "replacement-refresh-token"

    @responses.activate
    def test_reconnecting_cannot_silently_add_a_different_workspace(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="linear",
            external_id="existing-workspace",
            metadata=METADATA.copy(),
        )
        url, oauth_url = self._initialize_pipeline()
        mock_linear()

        response = self._authorize(url, oauth_url)

        assert response.status_code == 400
        assert "different workspace" in response.data["data"]["detail"]
        assert Integration.objects.filter(provider="linear").count() == 1
        integration.refresh_from_db()
        assert integration.metadata == METADATA

    def test_requires_feature_flag(self) -> None:
        url = reverse(self.endpoint, args=[self.organization.slug, "integration_pipeline"])
        response = self.client.post(
            url, data={"action": "initialize", "provider": "linear"}, format="json"
        )
        assert response.status_code == 404

    @responses.activate
    def test_non_admin_cannot_install(self) -> None:
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member")
        self.login_as(member)
        url = reverse(self.endpoint, args=[self.organization.slug, "integration_pipeline"])
        with self.feature("organizations:integrations-linear"):
            response = self.client.post(
                url, data={"action": "initialize", "provider": "linear"}, format="json"
            )
        assert response.status_code == 403
        assert len(responses.calls) == 0
