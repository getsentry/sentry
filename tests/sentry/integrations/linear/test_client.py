from typing import Any

import pytest
import requests
import responses

from sentry.exceptions import RestrictedIPAddress
from sentry.integrations.linear.client import (
    LINEAR_ERROR_MESSAGE,
    LINEAR_GRAPHQL_URL,
    LINEAR_INSUFFICIENT_PERMISSIONS_MESSAGE,
    LINEAR_INVALID_API_KEY_MESSAGE,
    LINEAR_UNREACHABLE_MESSAGE,
    validate_linear_api_key,
)
from sentry.shared_integrations.exceptions import IntegrationConfigurationError
from sentry.utils import json

WORKSPACE_RESPONSE = {"data": {"organization": {"id": "workspace-uuid", "name": "Example"}}}
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


def mock_linear(*, status: int = 200, body: Any = WORKSPACE_RESPONSE) -> None:
    responses.add(responses.POST, LINEAR_GRAPHQL_URL, status=status, json=body)


class TestValidateLinearApiKey:
    @responses.activate
    def test_returns_workspace_when_key_can_read_it(self) -> None:
        mock_linear()

        assert validate_linear_api_key("lin_api_key") == {
            "id": "workspace-uuid",
            "name": "Example",
        }

        request = responses.calls[0].request
        # Personal API keys go to the GraphQL API without a "Bearer" prefix.
        assert request.headers["Authorization"] == "lin_api_key"
        assert "organization" in json.loads(request.body)["query"]

    @pytest.mark.parametrize(
        "error", [requests.exceptions.ConnectionError("boom"), RestrictedIPAddress("blocked")]
    )
    @responses.activate
    def test_raises_unreachable_when_request_fails(self, error: Exception) -> None:
        responses.add(responses.POST, LINEAR_GRAPHQL_URL, body=error)

        with pytest.raises(IntegrationConfigurationError) as excinfo:
            validate_linear_api_key("lin_api_key")

        assert str(excinfo.value) == LINEAR_UNREACHABLE_MESSAGE

    @pytest.mark.parametrize(
        ("status", "body", "message"),
        [
            (401, AUTHENTICATION_ERROR_RESPONSE, LINEAR_INVALID_API_KEY_MESSAGE),
            (400, AUTHENTICATION_ERROR_RESPONSE, LINEAR_INVALID_API_KEY_MESSAGE),
            (401, None, LINEAR_INVALID_API_KEY_MESSAGE),
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
        mock_linear(status=status, body=body)

        with pytest.raises(IntegrationConfigurationError) as excinfo:
            validate_linear_api_key("lin_api_key")

        assert str(excinfo.value) == message

    @pytest.mark.parametrize(
        "body",
        [
            {"data": {"organization": None}},
            {"data": {"organization": {"id": "workspace-uuid"}}},
            {"data": {"organization": {"id": "workspace-uuid", "name": ""}}},
            {"unexpected": "shape"},
            ["not", "an", "object"],
            # A partial success still counts as a failure.
            {**WORKSPACE_RESPONSE, "errors": [{"message": "boom"}]},
        ],
    )
    @responses.activate
    def test_raises_error_when_response_is_malformed(self, body: Any) -> None:
        mock_linear(body=body)

        with pytest.raises(IntegrationConfigurationError) as excinfo:
            validate_linear_api_key("lin_api_key")

        assert str(excinfo.value) == LINEAR_ERROR_MESSAGE

    @responses.activate
    def test_raises_error_when_response_is_not_json(self) -> None:
        responses.add(responses.POST, LINEAR_GRAPHQL_URL, body="<html>oops</html>")

        with pytest.raises(IntegrationConfigurationError) as excinfo:
            validate_linear_api_key("lin_api_key")

        assert str(excinfo.value) == LINEAR_ERROR_MESSAGE

    @responses.activate
    def test_raises_error_when_linear_redirects(self) -> None:
        responses.add(
            responses.POST,
            LINEAR_GRAPHQL_URL,
            status=302,
            headers={"Location": "https://example.com"},
        )

        with pytest.raises(IntegrationConfigurationError) as excinfo:
            validate_linear_api_key("lin_api_key")

        assert str(excinfo.value) == LINEAR_ERROR_MESSAGE
        assert len(responses.calls) == 1
