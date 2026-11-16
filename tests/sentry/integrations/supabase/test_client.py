from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
import requests
import responses
from django.test import override_settings
from django.utils import timezone
from responses import matchers

from sentry.constants import ObjectStatus
from sentry.exceptions import RestrictedIPAddress
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration import integration_service
from sentry.integrations.supabase.client import (
    SUPABASE_AUTHORIZATION_ERROR,
    SUPABASE_MCP_RESOURCE,
    SUPABASE_ORGANIZATIONS_URL,
    SUPABASE_PERMISSIONS_ERROR,
    SUPABASE_RESPONSE_ERROR,
    SUPABASE_SCOPES,
    SUPABASE_TOKEN_URL,
    SUPABASE_UNREACHABLE_ERROR,
    SupabaseRefreshTokenError,
    exchange_authorization_code,
    refresh_access_token,
    validate_supabase_access_token,
)
from sentry.shared_integrations.exceptions import IntegrationConfigurationError
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode
from sentry.utils import json
from sentry.utils.locking import UnableToAcquireLock

TOKEN_RESPONSE = {
    "access_token": "supabase-access-token",
    "refresh_token": "supabase-refresh-token",
    "expires_in": 3600,
    "token_type": "Bearer",
}
ORGANIZATION_RESPONSE = [{"id": "org-slug", "slug": "org-slug", "name": "Example"}]


class TestSupabaseOAuthTokens:
    @pytest.fixture(autouse=True)
    def supabase_settings(self) -> Iterator[None]:
        with override_settings(
            SUPABASE_CLIENT_ID="sentry-app-id", SUPABASE_CLIENT_SECRET="sentry-app-secret"
        ):
            yield

    @responses.activate
    @freeze_time("2025-01-01T00:00:00Z")
    @pytest.mark.parametrize("status", [200, 201])
    def test_exchanges_code_with_basic_auth_and_pkce(self, status: int) -> None:
        responses.add(
            responses.POST,
            SUPABASE_TOKEN_URL,
            status=status,
            json=TOKEN_RESPONSE,
            match=[
                matchers.urlencoded_params_matcher(
                    {
                        "grant_type": "authorization_code",
                        "code": "authorization-code",
                        "redirect_uri": "https://example.com/extensions/supabase/setup/",
                        "code_verifier": "pkce-verifier",
                        "resource": SUPABASE_MCP_RESOURCE,
                    }
                ),
                matchers.header_matcher(
                    {"Authorization": "Basic c2VudHJ5LWFwcC1pZDpzZW50cnktYXBwLXNlY3JldA=="}
                ),
            ],
        )

        token = exchange_authorization_code(
            "authorization-code", "https://example.com/extensions/supabase/setup/", "pkce-verifier"
        )

        assert token.expires_at == datetime(2025, 1, 1, 1, tzinfo=UTC)
        assert token.as_metadata() == {
            "access_token": "supabase-access-token",
            "refresh_token": "supabase-refresh-token",
            "expires_at": "2025-01-01T01:00:00+00:00",
        }
        assert "supabase-access-token" not in repr(token)
        assert "supabase-refresh-token" not in repr(token)
        assert "supabase-access-token" not in token.json()
        assert "supabase-refresh-token" not in token.json()
        assert responses.calls[0].request.headers["Content-Type"] == (
            "application/x-www-form-urlencoded"
        )

    @responses.activate
    def test_refreshes_using_the_rotating_organization_grant(self) -> None:
        responses.add(
            responses.POST,
            SUPABASE_TOKEN_URL,
            json=TOKEN_RESPONSE,
            match=[
                matchers.urlencoded_params_matcher(
                    {
                        "grant_type": "refresh_token",
                        "refresh_token": "previous-refresh-token",
                        "resource": SUPABASE_MCP_RESOURCE,
                    }
                )
            ],
        )
        assert refresh_access_token("previous-refresh-token").as_metadata()["refresh_token"] == (
            "supabase-refresh-token"
        )

    @responses.activate
    def test_revoked_refresh_grant(self) -> None:
        responses.add(
            responses.POST,
            SUPABASE_TOKEN_URL,
            status=400,
            json={"error": "invalid_grant", "error_description": "Do not expose provider details"},
        )
        with pytest.raises(SupabaseRefreshTokenError) as excinfo:
            refresh_access_token("revoked-token")
        assert str(excinfo.value) == SUPABASE_AUTHORIZATION_ERROR

    @responses.activate
    @pytest.mark.parametrize(
        "body",
        [
            {},
            [],
            {**TOKEN_RESPONSE, "access_token": ""},
            {**TOKEN_RESPONSE, "access_token": 1},
            {**TOKEN_RESPONSE, "refresh_token": None},
            {**TOKEN_RESPONSE, "refresh_token": ""},
            {**TOKEN_RESPONSE, "expires_in": True},
            {**TOKEN_RESPONSE, "expires_in": "3600"},
            {**TOKEN_RESPONSE, "expires_in": 0},
            {**TOKEN_RESPONSE, "expires_in": -1},
            {**TOKEN_RESPONSE, "expires_in": 10**20},
            {**TOKEN_RESPONSE, "token_type": "unexpected"},
        ],
    )
    def test_rejects_malformed_token_responses(self, body: Any) -> None:
        responses.add(responses.POST, SUPABASE_TOKEN_URL, json=body)
        with pytest.raises(IntegrationConfigurationError, match=SUPABASE_RESPONSE_ERROR):
            refresh_access_token("refresh-token")

    @responses.activate
    @pytest.mark.parametrize(
        "scope",
        [
            None,
            [],
            "projects:read",
            " ".join(SUPABASE_SCOPES) + " projects:write",
            " ".join(SUPABASE_SCOPES) + " analytics_config:read",
            " ".join(SUPABASE_SCOPES) + " environment:read",
        ],
    )
    def test_rejects_incorrect_scopes_when_returned(self, scope: Any) -> None:
        responses.add(responses.POST, SUPABASE_TOKEN_URL, json={**TOKEN_RESPONSE, "scope": scope})
        with pytest.raises(IntegrationConfigurationError, match=SUPABASE_PERMISSIONS_ERROR):
            refresh_access_token("refresh-token")

    @responses.activate
    def test_accepts_observability_scopes_when_returned(self) -> None:
        responses.add(
            responses.POST,
            SUPABASE_TOKEN_URL,
            json={**TOKEN_RESPONSE, "scope": " ".join(reversed(SUPABASE_SCOPES))},
        )
        assert refresh_access_token("refresh-token").access_token.get_secret_value() == (
            "supabase-access-token"
        )

    @responses.activate
    @pytest.mark.parametrize("status", [400, 401, 403])
    def test_authorization_errors_do_not_expose_provider_responses(self, status: int) -> None:
        responses.add(
            responses.POST, SUPABASE_TOKEN_URL, status=status, body="Do not expose provider details"
        )
        with pytest.raises(IntegrationConfigurationError) as excinfo:
            exchange_authorization_code("code", "https://example.com/callback", "verifier")
        assert str(excinfo.value) == SUPABASE_AUTHORIZATION_ERROR

    @responses.activate
    @pytest.mark.parametrize("status", [302, 429, 503])
    def test_provider_errors(self, status: int) -> None:
        responses.add(
            responses.POST,
            SUPABASE_TOKEN_URL,
            status=status,
            body="not json",
            headers={"Location": "https://example.com"},
        )
        with pytest.raises(IntegrationConfigurationError, match=SUPABASE_RESPONSE_ERROR):
            refresh_access_token("refresh-token")
        assert len(responses.calls) == 1

    @responses.activate
    @pytest.mark.parametrize(
        "error", [requests.ConnectionError("boom"), RestrictedIPAddress("blocked")]
    )
    def test_network_errors(self, error: Exception) -> None:
        responses.add(responses.POST, SUPABASE_TOKEN_URL, body=error)
        with pytest.raises(IntegrationConfigurationError, match=SUPABASE_UNREACHABLE_ERROR):
            refresh_access_token("refresh-token")

    @responses.activate
    @override_settings(SUPABASE_CLIENT_SECRET="")
    def test_requires_sentry_app_configuration(self) -> None:
        with pytest.raises(IntegrationConfigurationError, match="not configured in Sentry"):
            refresh_access_token("refresh-token")
        assert len(responses.calls) == 0


class TestValidateSupabaseAccessToken:
    @responses.activate
    def test_identifies_the_authorized_organization(self) -> None:
        responses.add(responses.GET, SUPABASE_ORGANIZATIONS_URL, json=ORGANIZATION_RESPONSE)
        assert validate_supabase_access_token("token") == {"slug": "org-slug", "name": "Example"}
        assert responses.calls[0].request.headers["Authorization"] == "Bearer token"

    @responses.activate
    @pytest.mark.parametrize(
        "body",
        [
            [],
            {},
            [None],
            [{}],
            [{"slug": "org-slug"}],
            [{"slug": "", "name": "Example"}],
            ORGANIZATION_RESPONSE * 2,
        ],
    )
    def test_rejects_missing_or_ambiguous_organization(self, body: Any) -> None:
        responses.add(responses.GET, SUPABASE_ORGANIZATIONS_URL, json=body)
        with pytest.raises(IntegrationConfigurationError, match=SUPABASE_RESPONSE_ERROR):
            validate_supabase_access_token("token")

    @responses.activate
    @pytest.mark.parametrize(
        ("status", "message"),
        [
            (401, SUPABASE_AUTHORIZATION_ERROR),
            (403, SUPABASE_PERMISSIONS_ERROR),
            (503, SUPABASE_RESPONSE_ERROR),
        ],
    )
    def test_provider_errors(self, status: int, message: str) -> None:
        responses.add(responses.GET, SUPABASE_ORGANIZATIONS_URL, status=status)
        with pytest.raises(IntegrationConfigurationError) as excinfo:
            validate_supabase_access_token("token")
        assert str(excinfo.value) == message

    @responses.activate
    def test_malformed_response(self) -> None:
        responses.add(responses.GET, SUPABASE_ORGANIZATIONS_URL, body="not json")
        with pytest.raises(IntegrationConfigurationError, match=SUPABASE_RESPONSE_ERROR):
            validate_supabase_access_token("token")

    @responses.activate
    def test_network_error(self) -> None:
        responses.add(responses.GET, SUPABASE_ORGANIZATIONS_URL, body=requests.ConnectionError())
        with pytest.raises(IntegrationConfigurationError, match=SUPABASE_UNREACHABLE_ERROR):
            validate_supabase_access_token("token")


@all_silo_test
@override_settings(SUPABASE_CLIENT_ID="sentry-app-id", SUPABASE_CLIENT_SECRET="sentry-app-secret")
@freeze_time("2025-01-01T00:00:00Z")
class SupabaseTokenRefreshTest(TestCase):
    def create_supabase(self, **metadata: Any) -> Integration:
        return self.create_integration(
            organization=self.organization,
            provider="supabase",
            external_id="org-slug",
            metadata={
                "organization_slug": "org-slug",
                "access_token": "previous-token",
                "refresh_token": "previous-refresh-token",
                "expires_at": "2025-01-01T01:00:00+00:00",
                **metadata,
            },
        )

    def get_token(self, integration: Integration, *, force_refresh: bool = False) -> Any:
        return integration_service.get_access_token(
            integration_id=integration.id,
            organization_id=self.organization.id,
            force_refresh=force_refresh,
        )

    def age_credentials(self, integration: Integration) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            Integration.objects.filter(id=integration.id).update(
                date_updated=timezone.now() - timedelta(minutes=1)
            )

    @responses.activate
    def test_reuses_valid_token(self) -> None:
        token = self.get_token(self.create_supabase())
        assert token is not None
        assert token.token == "previous-token"
        assert token.expires_at == datetime(2025, 1, 1, 1, tzinfo=UTC)
        assert len(responses.calls) == 0

    @responses.activate
    def test_rotates_both_tokens_before_expiry(self) -> None:
        integration = self.create_supabase(expires_at="2025-01-01T00:04:00+00:00")
        responses.add(responses.POST, SUPABASE_TOKEN_URL, json=TOKEN_RESPONSE, status=201)

        token = self.get_token(integration)

        assert token is not None
        assert token.token == "supabase-access-token"
        assert "supabase-access-token" not in repr(token)
        assert self.get_token(integration) == token
        assert len(responses.calls) == 1
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration.refresh_from_db()
        assert integration.metadata == {"organization_slug": "org-slug", **TOKEN_RESPONSE_METADATA}

    @responses.activate
    def test_forced_refreshes_reuse_a_concurrent_replacement(self) -> None:
        integration = self.create_supabase()
        self.age_credentials(integration)
        responses.add(responses.POST, SUPABASE_TOKEN_URL, json=TOKEN_RESPONSE)

        first = self.get_token(integration, force_refresh=True)
        second = self.get_token(integration, force_refresh=True)

        assert first is not None
        assert first.token == "supabase-access-token"
        assert first == second
        assert len(responses.calls) == 1

    @responses.activate
    def test_next_refresh_uses_rotated_refresh_token(self) -> None:
        integration = self.create_supabase(expires_at=None)
        responses.add(responses.POST, SUPABASE_TOKEN_URL, json=TOKEN_RESPONSE)
        assert self.get_token(integration) is not None
        self.age_credentials(integration)
        responses.add(
            responses.POST,
            SUPABASE_TOKEN_URL,
            json={**TOKEN_RESPONSE, "access_token": "next-token", "refresh_token": "next-refresh"},
            match=[
                matchers.urlencoded_params_matcher(
                    {
                        "grant_type": "refresh_token",
                        "refresh_token": "supabase-refresh-token",
                        "resource": SUPABASE_MCP_RESOURCE,
                    }
                )
            ],
        )
        token = self.get_token(integration, force_refresh=True)
        assert token is not None
        assert token.token == "next-token"
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration.refresh_from_db()
        assert integration.metadata["refresh_token"] == "next-refresh"

    @responses.activate
    def test_revoked_grant_disables_integration(self) -> None:
        integration = self.create_supabase(expires_at=None)
        responses.add(
            responses.POST, SUPABASE_TOKEN_URL, status=400, json={"error": "invalid_grant"}
        )
        assert self.get_token(integration) is None
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration.refresh_from_db()
        assert integration.status == ObjectStatus.DISABLED
        assert self.get_token(integration) is None
        assert len(responses.calls) == 1

    @responses.activate
    def test_transient_failure_preserves_grant(self) -> None:
        integration = self.create_supabase(expires_at=None)
        responses.add(responses.POST, SUPABASE_TOKEN_URL, status=503)
        assert self.get_token(integration) is None
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration.refresh_from_db()
        assert integration.status == ObjectStatus.ACTIVE
        assert integration.metadata["refresh_token"] == "previous-refresh-token"

    @responses.activate
    def test_other_organization_cannot_refresh_grant(self) -> None:
        integration = self.create_supabase()
        assert (
            integration_service.get_access_token(
                integration_id=integration.id,
                organization_id=self.create_organization().id,
                force_refresh=True,
            )
            is None
        )
        assert len(responses.calls) == 0

    @responses.activate
    @patch("sentry.utils.locking.lock.Lock.blocking_acquire", side_effect=UnableToAcquireLock)
    def test_lock_timeout_reuses_valid_token(self, mock_acquire: MagicMock) -> None:
        assert self.get_token(self.create_supabase()).token == "previous-token"
        assert len(responses.calls) == 0

    @responses.activate
    @patch("sentry.utils.locking.lock.Lock.blocking_acquire", side_effect=UnableToAcquireLock)
    def test_lock_timeout_does_not_reuse_rejected_token(self, mock_acquire: MagicMock) -> None:
        integration = self.create_supabase()
        self.age_credentials(integration)
        assert self.get_token(integration, force_refresh=True) is None
        assert len(responses.calls) == 0

    @responses.activate
    def test_refresh_does_not_overwrite_concurrent_reauthorization(self) -> None:
        integration = self.create_supabase(expires_at=None)

        def reauthorize(request: Any) -> tuple[int, dict[str, str], str]:
            with assume_test_silo_mode(SiloMode.CONTROL):
                Integration.objects.filter(id=integration.id).update(
                    metadata={"refresh_token": "reauthorized-refresh"},
                    date_updated=timezone.now() + timedelta(seconds=1),
                )
            return 201, {"Content-Type": "application/json"}, json.dumps(TOKEN_RESPONSE)

        responses.add_callback(responses.POST, SUPABASE_TOKEN_URL, callback=reauthorize)
        assert self.get_token(integration) is None
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration.refresh_from_db()
        assert integration.metadata == {"refresh_token": "reauthorized-refresh"}

    @responses.activate
    def test_revoked_old_grant_does_not_disable_reauthorization(self) -> None:
        integration = self.create_supabase(expires_at=None)

        def reauthorize(request: Any) -> tuple[int, dict[str, str], str]:
            with assume_test_silo_mode(SiloMode.CONTROL):
                Integration.objects.filter(id=integration.id).update(
                    metadata={"refresh_token": "reauthorized-refresh"},
                    date_updated=timezone.now() + timedelta(seconds=1),
                )
            return 400, {"Content-Type": "application/json"}, '{"error":"invalid_grant"}'

        responses.add_callback(responses.POST, SUPABASE_TOKEN_URL, callback=reauthorize)
        assert self.get_token(integration) is None
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration.refresh_from_db()
        assert integration.status == ObjectStatus.ACTIVE
        assert integration.metadata == {"refresh_token": "reauthorized-refresh"}


TOKEN_RESPONSE_METADATA = {
    "access_token": "supabase-access-token",
    "refresh_token": "supabase-refresh-token",
    "expires_at": "2025-01-01T01:00:00+00:00",
}
