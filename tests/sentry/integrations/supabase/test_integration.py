import base64
import hashlib
from typing import Any
from urllib.parse import parse_qs, urlparse

import pytest
import responses
from django.test import override_settings
from django.urls import reverse
from responses import matchers

from sentry.constants import ObjectStatus
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.supabase.client import (
    SUPABASE_AUTHORIZATION_ERROR,
    SUPABASE_MCP_RESOURCE,
    SUPABASE_ORGANIZATIONS_URL,
    SUPABASE_REVOKE_URL,
    SUPABASE_TOKEN_URL,
)
from sentry.integrations.supabase.integration import (
    SupabaseIntegration,
    SupabaseIntegrationProvider,
)
from sentry.shared_integrations.exceptions import IntegrationConfigurationError
from sentry.testutils.cases import APITestCase, IntegrationTestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import control_silo_test
from sentry.users.models.identity import Identity
from sentry.utils.http import absolute_uri

ORGANIZATION = {"slug": "org-slug", "name": "Example"}
TOKEN_METADATA = {
    "access_token": "supabase-token",
    "refresh_token": "supabase-refresh-token",
    "expires_at": "2025-01-01T01:00:00+00:00",
}
METADATA = {"organization_slug": "org-slug", **TOKEN_METADATA}


def mock_supabase(*, access_token: str = "supabase-token") -> None:
    responses.add(
        responses.POST,
        SUPABASE_TOKEN_URL,
        status=201,
        json={
            "access_token": access_token,
            "refresh_token": "supabase-refresh-token",
            "expires_in": 3600,
            "token_type": "Bearer",
        },
    )
    responses.add(
        responses.GET,
        SUPABASE_ORGANIZATIONS_URL,
        json=[{"id": "org-slug", **ORGANIZATION}],
    )


@override_settings(SUPABASE_CLIENT_ID="sentry-app-id", SUPABASE_CLIENT_SECRET="sentry-app-secret")
@control_silo_test
class SupabaseIntegrationProviderTest(IntegrationTestCase):
    @property
    def provider(self) -> type[SupabaseIntegrationProvider]:
        return SupabaseIntegrationProvider

    def create_supabase(self) -> Integration:
        return self.create_integration(
            organization=self.organization,
            provider="supabase",
            external_id="org-slug",
            metadata=METADATA.copy(),
        )

    def installation(self, integration: Integration) -> SupabaseIntegration:
        installation = integration.get_installation(organization_id=self.organization.id)
        assert isinstance(installation, SupabaseIntegration)
        return installation

    def test_provider_name_marks_seer_only_integration(self) -> None:
        assert self.provider().name == "Supabase for Seer"

    def test_build_integration_stores_organization_grant(self) -> None:
        provider = self.provider()
        provider.set_pipeline(self.pipeline)
        assert provider.build_integration(
            {"oauth_data": {"organization": ORGANIZATION, "token": TOKEN_METADATA}}
        ) == {"external_id": "org-slug", "name": "Supabase (Example)", "metadata": METADATA}

    def test_requires_authorization(self) -> None:
        with pytest.raises(IntegrationConfigurationError, match="Missing Supabase authorization"):
            self.provider().build_integration({})

    def test_config_does_not_expose_or_accept_credentials(self) -> None:
        integration = self.create_supabase()
        installation = self.installation(integration)
        assert installation.get_config_data() == {}
        assert installation.get_organization_config() == []
        with pytest.raises(IntegrationConfigurationError, match="Reconnect Supabase"):
            installation.update_organization_config({"access_token": "other-token"})
        integration.refresh_from_db()
        assert integration.metadata == METADATA
        assert OrganizationIntegration.objects.get(integration=integration).config == {}

    @responses.activate
    def test_uninstall_revokes_and_clears_last_organization_grant(self) -> None:
        integration = self.create_supabase()
        responses.add(
            responses.POST,
            SUPABASE_REVOKE_URL,
            status=204,
            match=[
                matchers.json_params_matcher(
                    {
                        "client_id": "sentry-app-id",
                        "client_secret": "sentry-app-secret",
                        "refresh_token": "supabase-refresh-token",
                    }
                )
            ],
        )

        self.installation(integration).uninstall()

        integration.refresh_from_db()
        assert integration.status == ObjectStatus.DISABLED
        assert integration.metadata == {"organization_slug": "org-slug"}
        assert len(responses.calls) == 1

    @responses.activate
    def test_uninstall_preserves_grant_used_by_another_sentry_organization(self) -> None:
        integration = self.create_supabase()
        integration.add_organization(self.create_organization())
        self.installation(integration).uninstall()
        integration.refresh_from_db()
        assert integration.metadata == METADATA
        assert integration.status == ObjectStatus.ACTIVE
        assert len(responses.calls) == 0

    @responses.activate
    def test_uninstall_ignores_other_installations_pending_deletion(self) -> None:
        integration = self.create_supabase()
        other_link = integration.add_organization(self.create_organization())
        assert other_link is not None
        other_link.update(status=ObjectStatus.PENDING_DELETION)
        responses.add(responses.POST, SUPABASE_REVOKE_URL, status=204)
        self.installation(integration).uninstall()
        integration.refresh_from_db()
        assert integration.metadata == {"organization_slug": "org-slug"}
        assert len(responses.calls) == 1

    @responses.activate
    def test_provider_failure_does_not_block_uninstall(self) -> None:
        integration = self.create_supabase()
        responses.add(responses.POST, SUPABASE_REVOKE_URL, status=503)
        self.installation(integration).uninstall()
        assert len(responses.calls) == 1


@override_settings(SUPABASE_CLIENT_ID="sentry-app-id", SUPABASE_CLIENT_SECRET="sentry-app-secret")
@control_silo_test
@freeze_time("2025-01-01T00:00:00Z")
class SupabaseApiPipelineTest(APITestCase):
    @property
    def endpoint(self) -> str:
        return "sentry-api-0-organization-pipeline"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def initialize_pipeline(self, organization_slug: str | None = None) -> tuple[str, str]:
        url = reverse(
            self.endpoint,
            args=[organization_slug or self.organization.slug, "integration_pipeline"],
        )
        with self.feature("organizations:integrations-supabase"):
            response = self.client.post(
                url, data={"action": "initialize", "provider": "supabase"}, format="json"
            )
        assert response.status_code == 200, response.content
        assert response.data["step"] == "oauth_login"
        return url, response.data["data"]["oauthUrl"]

    def authorize(self, url: str, oauth_url: str) -> Any:
        state = parse_qs(urlparse(oauth_url).query)["state"][0]
        return self.client.post(url, data={"code": "supabase-code", "state": state}, format="json")

    def test_starts_organization_authorization_with_pkce(self) -> None:
        _, oauth_url = self.initialize_pipeline()
        parsed = urlparse(oauth_url)
        assert (
            f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
            == "https://api.supabase.com/v1/oauth/authorize"
        )
        params = parse_qs(parsed.query)
        assert params["client_id"] == ["sentry-app-id"]
        assert params["response_type"] == ["code"]
        assert params["redirect_uri"] == [absolute_uri("/extensions/supabase/setup/")]
        assert params["code_challenge_method"] == ["S256"]
        assert params["resource"] == [SUPABASE_MCP_RESOURCE]
        assert len(params["code_challenge"][0]) == 43
        assert params["state"][0]
        assert "sentry-app-secret" not in oauth_url
        # Scopes are configured on the publishable app; Supabase deprecated this parameter.
        assert "scope" not in params
        assert "project_ref" not in params

    def test_reading_pipeline_preserves_pkce_and_state(self) -> None:
        url, oauth_url = self.initialize_pipeline()
        response = self.client.get(url)
        assert response.status_code == 200
        assert response.data["data"]["oauthUrl"] == oauth_url

    def test_each_installation_has_independent_state_and_pkce(self) -> None:
        _, first = self.initialize_pipeline()
        _, second = self.initialize_pipeline(self.create_organization(owner=self.user).slug)
        first_params = parse_qs(urlparse(first).query)
        second_params = parse_qs(urlparse(second).query)
        assert first_params["state"] != second_params["state"]
        assert first_params["code_challenge"] != second_params["code_challenge"]

    @responses.activate
    def test_installs_shared_grant_without_personal_identity(self) -> None:
        url, oauth_url = self.initialize_pipeline()
        mock_supabase()
        response = self.authorize(url, oauth_url)

        assert response.status_code == 200, response.content
        assert response.data["status"] == "complete"
        integration = Integration.objects.get(provider="supabase", external_id="org-slug")
        assert integration.name == "Supabase (Example)"
        assert integration.metadata == METADATA
        org_integration = OrganizationIntegration.objects.get(
            organization_id=self.organization.id, integration_id=integration.id
        )
        assert org_integration.default_auth_id is None
        assert not Identity.objects.filter(idp__type="supabase").exists()
        assert responses.calls[1].request.headers["Authorization"] == "Bearer supabase-token"
        params = parse_qs(urlparse(oauth_url).query)
        body = responses.calls[0].request.body
        assert isinstance(body, str)
        token_params = parse_qs(body)
        verifier = token_params["code_verifier"][0]
        assert (
            base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest())
            .rstrip(b"=")
            .decode()
            == params["code_challenge"][0]
        )
        assert token_params["redirect_uri"] == params["redirect_uri"]
        assert token_params["resource"] == [SUPABASE_MCP_RESOURCE]
        assert (
            responses.calls[0].request.headers["Authorization"]
            == "Basic c2VudHJ5LWFwcC1pZDpzZW50cnktYXBwLXNlY3JldA=="
        )
        assert "supabase-token" not in response.content.decode()
        assert "supabase-refresh-token" not in response.content.decode()
        assert "sentry-app-secret" not in response.content.decode()
        assert verifier not in response.content.decode()

    @responses.activate
    def test_invalid_state_never_exchanges_tokens(self) -> None:
        url, _ = self.initialize_pipeline()
        response = self.client.post(
            url, data={"code": "code", "state": "wrong-state"}, format="json"
        )
        assert response.status_code == 400
        assert not Integration.objects.filter(provider="supabase").exists()
        assert len(responses.calls) == 0

    @responses.activate
    def test_failed_authorization_can_be_retried(self) -> None:
        url, oauth_url = self.initialize_pipeline()
        responses.add(responses.POST, SUPABASE_TOKEN_URL, status=400)
        response = self.authorize(url, oauth_url)
        assert response.status_code == 400
        assert response.data["data"]["detail"] == SUPABASE_AUTHORIZATION_ERROR
        assert not Integration.objects.filter(provider="supabase").exists()
        assert self.client.get(url).data["step"] == "oauth_login"
        responses.reset()
        mock_supabase()
        assert self.authorize(url, oauth_url).data["status"] == "complete"

    @responses.activate
    def test_ambiguous_organization_grant_is_not_installed(self) -> None:
        url, oauth_url = self.initialize_pipeline()
        mock_supabase()
        responses.replace(
            responses.GET,
            SUPABASE_ORGANIZATIONS_URL,
            json=[ORGANIZATION, {"slug": "other-org", "name": "Other"}],
        )
        response = self.authorize(url, oauth_url)
        assert response.status_code == 400
        assert not Integration.objects.filter(provider="supabase").exists()

    @responses.activate
    def test_callback_uses_the_existing_trampoline(self) -> None:
        _, oauth_url = self.initialize_pipeline()
        response = self.client.get(
            "/extensions/supabase/setup/",
            data={"code": "code", "state": parse_qs(urlparse(oauth_url).query)["state"][0]},
        )
        assert response.status_code == 200
        assert b"window.opener.postMessage" in response.content
        assert len(responses.calls) == 0

    @responses.activate
    def test_reauthorization_replaces_the_shared_organization_grant(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="supabase",
            external_id="org-slug",
            metadata=METADATA.copy(),
            status=ObjectStatus.DISABLED,
        )
        url, oauth_url = self.initialize_pipeline()
        mock_supabase(access_token="replacement-token")
        assert self.authorize(url, oauth_url).status_code == 200
        integration.refresh_from_db()
        assert integration.status == ObjectStatus.ACTIVE
        assert integration.metadata["access_token"] == "replacement-token"
        assert Integration.objects.filter(provider="supabase").count() == 1

    @responses.activate
    def test_separately_authorized_sentry_organizations_share_token_rotation(self) -> None:
        url, oauth_url = self.initialize_pipeline()
        mock_supabase()
        assert self.authorize(url, oauth_url).status_code == 200
        other_org = self.create_organization(owner=self.user)
        url, oauth_url = self.initialize_pipeline(other_org.slug)
        responses.reset()
        mock_supabase(access_token="replacement-token")
        assert self.authorize(url, oauth_url).status_code == 200
        integration = Integration.objects.get(provider="supabase")
        assert integration.metadata["access_token"] == "replacement-token"
        assert OrganizationIntegration.objects.filter(integration=integration).count() == 2

    @responses.activate
    def test_reconnect_cannot_silently_switch_supabase_organizations(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="supabase",
            external_id="existing-org",
            metadata=METADATA.copy(),
        )
        url, oauth_url = self.initialize_pipeline()
        mock_supabase()
        response = self.authorize(url, oauth_url)
        assert response.status_code == 400
        assert "different organization" in response.data["data"]["detail"]
        integration.refresh_from_db()
        assert integration.metadata == METADATA
        assert Integration.objects.filter(provider="supabase").count() == 1

    def test_details_do_not_expose_credentials(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="supabase",
            external_id="org-slug",
            metadata=METADATA.copy(),
        )
        response = self.client.get(
            reverse(
                "sentry-api-0-organization-integration-details",
                args=[self.organization.slug, integration.id],
            )
        )
        assert response.status_code == 200
        assert response.data["configData"] == {}
        assert response.data["configOrganization"] == []
        assert "supabase-token" not in response.content.decode()
        assert "supabase-refresh-token" not in response.content.decode()
        assert "sentry-app-secret" not in response.content.decode()

    def test_requires_feature_flag(self) -> None:
        url = reverse(self.endpoint, args=[self.organization.slug, "integration_pipeline"])
        response = self.client.post(
            url, data={"action": "initialize", "provider": "supabase"}, format="json"
        )
        assert response.status_code == 404

    @responses.activate
    def test_non_admin_cannot_install(self) -> None:
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member")
        self.login_as(member)
        url = reverse(self.endpoint, args=[self.organization.slug, "integration_pipeline"])
        with self.feature("organizations:integrations-supabase"):
            response = self.client.post(
                url, data={"action": "initialize", "provider": "supabase"}, format="json"
            )
        assert response.status_code == 403
        assert len(responses.calls) == 0
