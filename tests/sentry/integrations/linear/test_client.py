from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Any

import pytest
import requests
import responses
from django.test import override_settings
from responses import matchers

from sentry.exceptions import RestrictedIPAddress
from sentry.integrations.linear.client import (
    LINEAR_AUTHORIZATION_ERROR_MESSAGE,
    LINEAR_ERROR_MESSAGE,
    LINEAR_GRAPHQL_URL,
    LINEAR_INSUFFICIENT_PERMISSIONS_MESSAGE,
    LINEAR_TOKEN_URL,
    LINEAR_UNREACHABLE_MESSAGE,
    LinearRefreshTokenError,
    exchange_authorization_code,
    refresh_access_token,
    validate_linear_access_token,
)
from sentry.shared_integrations.exceptions import IntegrationConfigurationError
from sentry.testutils.helpers.datetime import freeze_time
from sentry.utils import json

WORKSPACE_RESPONSE = {
    "data": {
        "organization": {"id": "workspace-uuid", "name": "Example"},
        "viewer": {"id": "app-user-id"},
    }
}
TOKEN_RESPONSE = {
    "access_token": "app-access-token",
    "refresh_token": "app-refresh-token",
    "expires_in": 86400,
    "token_type": "Bearer",
    "scope": "read write",
}
AUTHENTICATION_ERROR_RESPONSE = {
    "errors": [
        {
            "message": "Authentication required, not authenticated",
            "extensions": {"type": "authentication error", "code": "AUTHENTICATION_ERROR"},
        }
    ]
}
FORBIDDEN_RESPONSE = {
    "errors": [{"message": "Forbidden", "extensions": {"type": "forbidden", "code": "FORBIDDEN"}}]
}


class TestLinearOAuthTokens:
    @pytest.fixture(autouse=True)
    def linear_options(self) -> Iterator[None]:
        with override_settings(
            LINEAR_CLIENT_ID="sentry-app-id", LINEAR_CLIENT_SECRET="sentry-app-secret"
        ):
            yield

    @freeze_time("2025-01-01T00:00:00Z")
    @responses.activate
    @pytest.mark.parametrize(
        "scope", ["read write", "write read", "read,write", ["read", "write"], ["write", "read"]]
    )
    def test_exchanges_code_using_sentry_app_credentials(self, scope: str | list[str]) -> None:
        responses.add(
            responses.POST,
            LINEAR_TOKEN_URL,
            match=[
                matchers.urlencoded_params_matcher(
                    {
                        "grant_type": "authorization_code",
                        "client_id": "sentry-app-id",
                        "client_secret": "sentry-app-secret",
                        "code": "authorization-code",
                        "redirect_uri": "https://example.com/extensions/linear/setup/",
                    }
                )
            ],
            json={**TOKEN_RESPONSE, "scope": scope},
        )

        token = exchange_authorization_code(
            "authorization-code", "https://example.com/extensions/linear/setup/"
        )

        assert token.access_token.get_secret_value() == "app-access-token"
        assert token.refresh_token.get_secret_value() == "app-refresh-token"
        assert token.expires_at == datetime(2025, 1, 2, tzinfo=UTC)
        assert "app-access-token" not in repr(token)
        assert "app-refresh-token" not in repr(token)
        assert "app-access-token" not in token.json()
        assert "app-refresh-token" not in token.json()
        assert token.as_metadata() == {
            "access_token": "app-access-token",
            "refresh_token": "app-refresh-token",
            "expires_at": "2025-01-02T00:00:00+00:00",
            "scopes": ["read", "write"],
        }
        assert responses.calls[0].request.headers["Content-Type"] == (
            "application/x-www-form-urlencoded"
        )

    @responses.activate
    def test_refreshes_with_the_installations_refresh_token(self) -> None:
        responses.add(
            responses.POST,
            LINEAR_TOKEN_URL,
            match=[
                matchers.urlencoded_params_matcher(
                    {
                        "grant_type": "refresh_token",
                        "client_id": "sentry-app-id",
                        "client_secret": "sentry-app-secret",
                        "refresh_token": "previous-refresh-token",
                    }
                )
            ],
            json=TOKEN_RESPONSE,
        )

        token = refresh_access_token("previous-refresh-token")

        assert token.refresh_token.get_secret_value() == "app-refresh-token"
        assert token.access_token.get_secret_value() == "app-access-token"

    @responses.activate
    def test_revoked_refresh_grant(self) -> None:
        responses.add(
            responses.POST,
            LINEAR_TOKEN_URL,
            status=400,
            json={"error": "invalid_grant", "error_description": "Do not expose provider details"},
        )
        with pytest.raises(LinearRefreshTokenError) as excinfo:
            refresh_access_token("revoked-refresh-token")
        assert str(excinfo.value) == LINEAR_AUTHORIZATION_ERROR_MESSAGE

    @responses.activate
    @pytest.mark.parametrize("status", [400, 401, 403])
    def test_rejected_authorization(self, status: int) -> None:
        responses.add(
            responses.POST,
            LINEAR_TOKEN_URL,
            status=status,
            json={"error_description": "Do not expose provider response details"},
        )
        with pytest.raises(IntegrationConfigurationError) as excinfo:
            exchange_authorization_code("bad-code", "https://example.com/callback")
        assert str(excinfo.value) == LINEAR_AUTHORIZATION_ERROR_MESSAGE

    @responses.activate
    @pytest.mark.parametrize(
        "body",
        [
            {},
            [],
            {**TOKEN_RESPONSE, "access_token": ""},
            {**TOKEN_RESPONSE, "access_token": 1},
            {**TOKEN_RESPONSE, "refresh_token": ""},
            {**TOKEN_RESPONSE, "refresh_token": None},
            {**TOKEN_RESPONSE, "expires_in": 0},
            {**TOKEN_RESPONSE, "expires_in": -1},
            {**TOKEN_RESPONSE, "expires_in": True},
            {**TOKEN_RESPONSE, "expires_in": "3600"},
            {**TOKEN_RESPONSE, "expires_in": 10**20},
            {**TOKEN_RESPONSE, "token_type": "unexpected"},
            {**TOKEN_RESPONSE, "scope": "read"},
            {**TOKEN_RESPONSE, "scope": ["read"]},
            {**TOKEN_RESPONSE, "scope": "read write admin"},
            {**TOKEN_RESPONSE, "scope": "read read"},
            {**TOKEN_RESPONSE, "scope": None},
        ],
    )
    def test_rejects_malformed_or_overprivileged_token(self, body: Any) -> None:
        responses.add(responses.POST, LINEAR_TOKEN_URL, json=body)
        with pytest.raises(IntegrationConfigurationError, match=LINEAR_ERROR_MESSAGE):
            exchange_authorization_code("code", "https://example.com/callback")

    @responses.activate
    @pytest.mark.parametrize("status", [302, 429, 500])
    def test_provider_failure(self, status: int) -> None:
        responses.add(
            responses.POST,
            LINEAR_TOKEN_URL,
            status=status,
            headers={"Location": "https://example.com"},
            body="not json",
        )
        with pytest.raises(IntegrationConfigurationError, match=LINEAR_ERROR_MESSAGE):
            refresh_access_token("refresh-token")
        assert len(responses.calls) == 1

    @responses.activate
    @pytest.mark.parametrize(
        "error", [requests.exceptions.ConnectionError("boom"), RestrictedIPAddress("blocked")]
    )
    def test_network_failure(self, error: Exception) -> None:
        responses.add(responses.POST, LINEAR_TOKEN_URL, body=error)
        with pytest.raises(IntegrationConfigurationError, match=LINEAR_UNREACHABLE_MESSAGE):
            refresh_access_token("refresh-token")

    @responses.activate
    @override_settings(LINEAR_CLIENT_SECRET="")
    def test_missing_sentry_app_configuration(self) -> None:
        with pytest.raises(IntegrationConfigurationError, match="not configured in Sentry"):
            refresh_access_token("refresh-token")
        assert len(responses.calls) == 0


class TestValidateLinearAccessToken:
    @responses.activate
    def test_returns_workspace_and_app_identity_using_bearer_token(self) -> None:
        responses.add(responses.POST, LINEAR_GRAPHQL_URL, json=WORKSPACE_RESPONSE)

        assert validate_linear_access_token("app-token") == {
            "id": "workspace-uuid",
            "name": "Example",
            "app_user_id": "app-user-id",
        }
        request = responses.calls[0].request
        assert request.headers["Authorization"] == "Bearer app-token"
        query = json.loads(request.body)["query"]
        assert "organization" in query
        assert "viewer" in query

    @pytest.mark.parametrize(
        "error", [requests.exceptions.ConnectionError("boom"), RestrictedIPAddress("blocked")]
    )
    @responses.activate
    def test_raises_unreachable_when_request_fails(self, error: Exception) -> None:
        responses.add(responses.POST, LINEAR_GRAPHQL_URL, body=error)
        with pytest.raises(IntegrationConfigurationError, match=LINEAR_UNREACHABLE_MESSAGE):
            validate_linear_access_token("app-token")

    @pytest.mark.parametrize(
        ("status", "body", "message"),
        [
            (401, AUTHENTICATION_ERROR_RESPONSE, LINEAR_AUTHORIZATION_ERROR_MESSAGE),
            (400, AUTHENTICATION_ERROR_RESPONSE, LINEAR_AUTHORIZATION_ERROR_MESSAGE),
            (401, None, LINEAR_AUTHORIZATION_ERROR_MESSAGE),
            (403, None, LINEAR_INSUFFICIENT_PERMISSIONS_MESSAGE),
            (200, FORBIDDEN_RESPONSE, LINEAR_INSUFFICIENT_PERMISSIONS_MESSAGE),
            (400, FORBIDDEN_RESPONSE, LINEAR_INSUFFICIENT_PERMISSIONS_MESSAGE),
            (429, {"errors": [{"extensions": {"code": "RATELIMITED"}}]}, LINEAR_ERROR_MESSAGE),
            (500, None, LINEAR_ERROR_MESSAGE),
        ],
    )
    @responses.activate
    def test_raises_when_linear_reports_an_error(
        self, status: int, body: Any, message: str
    ) -> None:
        responses.add(responses.POST, LINEAR_GRAPHQL_URL, status=status, json=body)
        with pytest.raises(IntegrationConfigurationError) as excinfo:
            validate_linear_access_token("app-token")
        assert str(excinfo.value) == message

    @pytest.mark.parametrize(
        "body",
        [
            {"data": {"organization": None}},
            {"data": {"organization": {"id": "workspace-uuid"}}},
            {"data": {"organization": {"id": "workspace-uuid", "name": ""}}},
            {"data": {"organization": {"id": "workspace-uuid", "name": "Example"}}},
            {"unexpected": "shape"},
            ["not", "an", "object"],
            {**WORKSPACE_RESPONSE, "errors": [{"message": "boom"}]},
        ],
    )
    @responses.activate
    def test_raises_error_when_response_is_malformed(self, body: Any) -> None:
        responses.add(responses.POST, LINEAR_GRAPHQL_URL, json=body)
        with pytest.raises(IntegrationConfigurationError, match=LINEAR_ERROR_MESSAGE):
            validate_linear_access_token("app-token")

    @responses.activate
    @pytest.mark.parametrize("status", [200, 302])
    def test_rejects_non_json_and_redirects(self, status: int) -> None:
        responses.add(
            responses.POST,
            LINEAR_GRAPHQL_URL,
            status=status,
            body="<html>oops</html>",
            headers={"Location": "https://example.com"},
        )
        with pytest.raises(IntegrationConfigurationError, match=LINEAR_ERROR_MESSAGE):
            validate_linear_access_token("app-token")
        assert len(responses.calls) == 1
