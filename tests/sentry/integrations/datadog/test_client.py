from typing import Any

import pytest
import requests
import responses

from sentry.integrations.datadog.client import validate_datadog_credentials
from sentry.shared_integrations.exceptions import IntegrationConfigurationError
from sentry.utils import json

MCP_URL = "https://mcp.datadoghq.com/api/unstable/mcp-server/mcp"


def _mock_initialize() -> None:
    # First MCP call: initialize -> returns the session id header mcp_whoami needs.
    responses.add(responses.POST, MCP_URL, status=200, headers={"mcp-session-id": "sess-1"})


def _mock_whoami(whoami: dict[str, Any]) -> None:
    _mock_initialize()
    responses.add(
        responses.POST,
        MCP_URL,
        status=200,
        json={"result": {"contents": [{"text": json.dumps(whoami)}]}},
    )


@responses.activate
def test_validate_returns_whoami_and_sends_dd_headers() -> None:
    _mock_whoami({"user_uuid": "u-1", "org_uuid": "org-1"})

    result = validate_datadog_credentials("api", "app", "datadoghq.com")

    assert result["org_uuid"] == "org-1"
    sent = responses.calls[0].request.headers
    assert sent["DD-API-KEY"] == "api"
    assert sent["DD-APPLICATION-KEY"] == "app"
    assert "Authorization" not in sent


def test_validate_rejects_invalid_site() -> None:
    # Bad site short-circuits before any HTTP call.
    with pytest.raises(IntegrationConfigurationError, match="Invalid Datadog site"):
        validate_datadog_credentials("api", "app", "not-a-site.example")


@responses.activate
def test_validate_translates_auth_error() -> None:
    responses.add(responses.POST, MCP_URL, status=403, json={"error": "forbidden"})

    with pytest.raises(IntegrationConfigurationError, match="Invalid Datadog API"):
        validate_datadog_credentials("api", "app", "datadoghq.com")


@responses.activate
def test_validate_translates_network_error() -> None:
    responses.add(responses.POST, MCP_URL, body=requests.exceptions.ConnectionError("boom"))

    with pytest.raises(IntegrationConfigurationError, match="Could not reach Datadog"):
        validate_datadog_credentials("api", "app", "datadoghq.com")


@responses.activate
def test_validate_translates_unexpected_response() -> None:
    _mock_initialize()
    responses.add(responses.POST, MCP_URL, status=200, json={"unexpected": "shape"})

    with pytest.raises(IntegrationConfigurationError, match="unexpected response"):
        validate_datadog_credentials("api", "app", "datadoghq.com")


@responses.activate
def test_validate_requires_org_uuid() -> None:
    _mock_whoami({"user_uuid": "u-1"})  # whoami omits org_uuid

    with pytest.raises(IntegrationConfigurationError, match="missing expected user/organization"):
        validate_datadog_credentials("api", "app", "datadoghq.com")


@responses.activate
def test_validate_requires_user_uuid() -> None:
    _mock_whoami({"org_uuid": "org-1"})

    with pytest.raises(IntegrationConfigurationError, match="missing expected user/organization"):
        validate_datadog_credentials("api", "app", "datadoghq.com")
