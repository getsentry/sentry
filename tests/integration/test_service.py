from time import time
from typing import Any
from unittest import mock

import requests
import responses

from sentry.constants import ObjectStatus
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode_of
from sentry.users.models.identity import Identity


@all_silo_test
@freeze_time("2025-01-01T05:22:00Z")
class IntegrationServiceTest(TestCase):
    jwt = "my_cool_jwt"

    def generate_integration(self, metadata: dict[str, Any] | None = None):
        integration = self.create_integration(
            organization=self.organization,
            provider="github",
            external_id="github:1",
        )

        with assume_test_silo_mode_of(Integration):
            if metadata is not None:
                integration.metadata.update(metadata)
                integration.save()

        return integration

    @responses.activate
    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=jwt)
    def test_refresh_expired_token(self, mock_jwt):
        integration = self.generate_integration(
            metadata={
                "access_token": "token_1",
                "expires_at": "2025-01-01T05:21:59Z",
                "permissions": {
                    "administration": "read",
                    "contents": "read",
                    "issues": "write",
                    "metadata": "read",
                    "pull_requests": "read",
                },
            }
        )

        responses.add(
            responses.POST,
            "https://api.github.com/app/installations/github:1/access_tokens",
            json={
                "token": "token_2",
                "expires_at": "2025-01-01T06:22:00Z",
                "permissions": {
                    "administration": "read",
                },
            },
            status=200,
            content_type="application/json",
        )

        rpc_integration = integration_service.refresh_github_access_token(
            integration_id=integration.id,
            organization_id=self.organization.id,
        )

        assert rpc_integration is not None
        assert rpc_integration.metadata["access_token"] == "token_2"
        assert rpc_integration.metadata["expires_at"] == "2025-01-01T06:22:00"
        assert rpc_integration.metadata["permissions"] == {
            "administration": "read",
        }

    @responses.activate
    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=jwt)
    def test_refresh_token_within_grace_period(self, mock_jwt):
        integration = self.generate_integration(
            metadata={
                "access_token": "token_1",
                "expires_at": "2025-01-01T05:31:59Z",
                "permissions": {
                    "contents": "read",
                },
            }
        )

        responses.add(
            responses.POST,
            "https://api.github.com/app/installations/github:1/access_tokens",
            json={
                "token": "token_refreshed",
                "expires_at": "2025-01-01T06:32:00Z",
                "permissions": {
                    "contents": "write",
                },
            },
            status=200,
            content_type="application/json",
        )

        rpc_integration = integration_service.refresh_github_access_token(
            integration_id=integration.id,
            organization_id=self.organization.id,
        )

        assert rpc_integration is not None
        assert rpc_integration.metadata["access_token"] == "token_refreshed"
        assert rpc_integration.metadata["expires_at"] == "2025-01-01T06:32:00"
        assert rpc_integration.metadata["permissions"] == {
            "contents": "write",
        }

    @responses.activate
    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=jwt)
    def test_no_refresh_token_outside_grace_period(self, mock_jwt):
        integration = self.generate_integration(
            metadata={
                "access_token": "token_valid",
                "expires_at": "2025-01-01T05:32:01Z",
                "permissions": {
                    "issues": "write",
                },
            }
        )
        rpc_integration = integration_service.refresh_github_access_token(
            integration_id=integration.id,
            organization_id=self.organization.id,
        )

        assert rpc_integration is not None
        assert rpc_integration.metadata["access_token"] == "token_valid"
        assert rpc_integration.metadata["expires_at"] == "2025-01-01T05:32:01Z"
        assert rpc_integration.metadata["permissions"] == {
            "issues": "write",
        }

    @responses.activate
    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=jwt)
    def test_refresh_token_missing_expiration_time(self, mock_jwt):
        integration = self.generate_integration(
            metadata={
                "access_token": "token_no_expiry",
                "permissions": {
                    "metadata": "read",
                },
            }
        )

        responses.add(
            responses.POST,
            "https://api.github.com/app/installations/github:1/access_tokens",
            json={
                "token": "token_new",
                "expires_at": "2025-01-01T06:22:00Z",
                "permissions": {
                    "metadata": "write",
                    "pull_requests": "read",
                },
            },
            status=200,
            content_type="application/json",
        )

        rpc_integration = integration_service.refresh_github_access_token(
            integration_id=integration.id,
            organization_id=self.organization.id,
        )

        assert rpc_integration is not None
        assert rpc_integration.metadata["access_token"] == "token_new"
        assert rpc_integration.metadata["expires_at"] == "2025-01-01T06:22:00"
        assert rpc_integration.metadata["permissions"] == {
            "metadata": "write",
            "pull_requests": "read",
        }

    def test_missing_integration(self):
        rpc_integration = integration_service.refresh_github_access_token(
            integration_id=12345,
            organization_id=self.organization.id,
        )

        assert rpc_integration is None

    def test_disabled_integration(self):
        integration = self.generate_integration()
        with assume_test_silo_mode_of(Integration):
            integration.status = ObjectStatus.DISABLED
            integration.save()

        rpc_integration = integration_service.refresh_github_access_token(
            integration_id=integration.id,
            organization_id=self.organization.id,
        )

        assert rpc_integration is None

    def test_missing_installation(self):
        # Generate a new integration with an installation on a different org.
        integration = self.create_integration(
            organization=self.create_organization(owner=self.create_user()),
            provider="github",
            external_id="github:1",
        )

        rpc_integration = integration_service.refresh_github_access_token(
            integration_id=integration.id,
            organization_id=self.organization.id,
        )

        assert rpc_integration is None


@all_silo_test
class GiteaAccessTokenServiceTest(TestCase):
    """Covers ``refresh_gitea_access_token``.

    The Gitea token is a user-scoped OAuth token on ``Identity.data``, not a value on
    ``Integration.metadata``, so this RPC is the only way an outside caller (getsentry's
    Claude Code client) can reach it.
    """

    base_url = "https://gitea.example.com"

    def generate_integration(
        self,
        *,
        organization=None,
        metadata: dict[str, Any] | None = None,
        identity_data: dict[str, Any] | None = None,
    ) -> Integration:
        with assume_test_silo_mode_of(Integration):
            return self._build_integration(
                organization=organization, metadata=metadata, identity_data=identity_data
            )

    def _build_integration(
        self,
        *,
        organization=None,
        metadata: dict[str, Any] | None = None,
        identity_data: dict[str, Any] | None = None,
    ) -> Integration:
        integration = self.create_provider_integration(
            provider=IntegrationProviderSlug.GITEA.value,
            name="gitea.example.com",
            external_id="gitea.example.com:client-id",
            metadata=(
                metadata
                if metadata is not None
                else {
                    "instance": "gitea.example.com",
                    "domain_name": "gitea.example.com",
                    "base_url": self.base_url,
                    "verify_ssl": True,
                    "webhook_secret": "hook-secret",
                }
            ),
        )
        identity = self.create_identity(
            user=self.user,
            identity_provider=self.create_identity_provider(
                type=IntegrationProviderSlug.GITEA.value
            ),
            external_id="gitea.example.com:42",
            data=(
                identity_data
                if identity_data is not None
                else {
                    "access_token": "access-token",
                    "refresh_token": "refresh-token",
                    # Far future: the token is valid, so no refresh should fire.
                    "expires": 9999999999,
                    "client_id": "client-id",
                    "client_secret": "client-secret",
                }
            ),
        )
        integration.add_organization(organization or self.organization, self.user, identity.id)
        return integration

    @responses.activate
    def test_returns_the_token_with_the_instance_base_url(self):
        # No refresh stub is registered: `responses` fails the test if one fires, which
        # is the assertion that a still-valid token is handed back untouched.
        integration = self.generate_integration()

        token = integration_service.refresh_gitea_access_token(
            integration_id=integration.id,
            organization_id=self.organization.id,
        )

        assert token is not None
        assert token.access_token == "access-token"
        # The install-time URL verbatim, not a hostname the caller would reassemble.
        assert token.base_url == self.base_url
        assert token.expires == 9999999999
        assert token.verify_ssl is True

    @responses.activate
    def test_carries_verify_ssl_from_the_integration(self):
        # Self-hosted instances behind a private CA install with verification off. A
        # caller that hardcodes it fails against them where Sentry itself succeeds.
        integration = self.generate_integration(
            metadata={"base_url": self.base_url, "verify_ssl": False}
        )

        token = integration_service.refresh_gitea_access_token(
            integration_id=integration.id,
            organization_id=self.organization.id,
        )

        assert token is not None
        assert token.verify_ssl is False

    @responses.activate
    def test_refreshes_a_token_that_is_about_to_expire(self):
        responses.add(
            responses.POST,
            f"{self.base_url}/login/oauth/access_token",
            json={
                "access_token": "fresh-access-token",
                "refresh_token": "fresh-refresh-token",
                "expires_in": 3600,
                "token_type": "bearer",
            },
        )
        integration = self.generate_integration(
            identity_data={
                "access_token": "stale-access-token",
                "refresh_token": "refresh-token",
                "expires": 1,
                "client_id": "client-id",
                "client_secret": "client-secret",
            }
        )

        token = integration_service.refresh_gitea_access_token(
            integration_id=integration.id,
            organization_id=self.organization.id,
        )

        assert token is not None
        assert token.access_token == "fresh-access-token"
        # The stub grants another hour; what would regress is the new expiry not
        # landing on the response at all, or landing as the stale one.
        assert token.expires is not None and token.expires > time() + 3000

    @responses.activate
    def test_returns_none_when_the_refresh_fails(self):
        # A proxy answering the token endpoint with an HTML login page is the
        # realistic shape of this; it must not escape as a 500 to the caller.
        responses.add(
            responses.POST,
            f"{self.base_url}/login/oauth/access_token",
            body="<html>sign in</html>",
            content_type="text/html",
        )
        integration = self.generate_integration(
            identity_data={
                "access_token": "stale-access-token",
                "refresh_token": "refresh-token",
                "expires": 1,
                "client_id": "client-id",
                "client_secret": "client-secret",
            }
        )

        assert (
            integration_service.refresh_gitea_access_token(
                integration_id=integration.id,
                organization_id=self.organization.id,
            )
            is None
        )

    def test_returns_none_when_the_installer_identity_is_gone(self):
        # `OrganizationIntegration.default_auth_id` is not a foreign key, so deleting
        # the installing user leaves a dangling id behind. This is the most likely way
        # a Gitea integration goes bad, and it must not escape as an exception.
        integration = self.generate_integration()
        with assume_test_silo_mode_of(Identity):
            Identity.objects.filter(external_id="gitea.example.com:42").delete()

        assert (
            integration_service.refresh_gitea_access_token(
                integration_id=integration.id,
                organization_id=self.organization.id,
            )
            is None
        )

    @responses.activate
    def test_returns_none_when_the_instance_is_unreachable(self):
        # Self-hosted instances go away, move, or let a certificate lapse. None of
        # those raise ApiError on the OAuth refresh path.
        responses.add(
            responses.POST,
            f"{self.base_url}/login/oauth/access_token",
            body=requests.exceptions.ConnectionError("connection refused"),
        )
        integration = self.generate_integration(
            identity_data={
                "access_token": "stale-access-token",
                "refresh_token": "refresh-token",
                "expires": 1,
                "client_id": "client-id",
                "client_secret": "client-secret",
            }
        )

        assert (
            integration_service.refresh_gitea_access_token(
                integration_id=integration.id,
                organization_id=self.organization.id,
            )
            is None
        )

    def test_missing_base_url(self):
        # Every Gitea URL is built from `base_url`; without it nothing downstream works.
        integration = self.generate_integration(metadata={"instance": "gitea.example.com"})

        assert (
            integration_service.refresh_gitea_access_token(
                integration_id=integration.id,
                organization_id=self.organization.id,
            )
            is None
        )

    def test_missing_integration(self):
        assert (
            integration_service.refresh_gitea_access_token(
                integration_id=12345,
                organization_id=self.organization.id,
            )
            is None
        )

    def test_disabled_integration(self):
        integration = self.generate_integration()
        with assume_test_silo_mode_of(Integration):
            integration.status = ObjectStatus.DISABLED
            integration.save()

        assert (
            integration_service.refresh_gitea_access_token(
                integration_id=integration.id,
                organization_id=self.organization.id,
            )
            is None
        )

    def test_missing_installation(self):
        integration = self.generate_integration(
            organization=self.create_organization(owner=self.create_user())
        )

        assert (
            integration_service.refresh_gitea_access_token(
                integration_id=integration.id,
                organization_id=self.organization.id,
            )
            is None
        )

    def test_non_gitea_integration_is_not_matched(self):
        # The provider filter is what keeps this from handing back a GitHub
        # installation token to a caller that will send it to a Gitea host.
        integration = self.create_integration(
            organization=self.organization,
            provider="github",
            external_id="github:1",
        )

        assert (
            integration_service.refresh_gitea_access_token(
                integration_id=integration.id,
                organization_id=self.organization.id,
            )
            is None
        )
