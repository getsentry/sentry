import json

import pytest
import responses

from sentry.integrations.datadog.client import validate_datadog_credentials
from sentry.shared_integrations.exceptions import IntegrationConfigurationError

MCP_URL = "https://mcp.datadoghq.com/api/unstable/mcp-server/mcp"


def _mock_initialize() -> None:
    # First MCP call: initialize -> returns the session id header mcp_whoami needs.
    responses.add(responses.POST, MCP_URL, status=200, headers={"mcp-session-id": "sess-1"})


def _mock_whoami(whoami: dict) -> None:
    _mock_initialize()
    responses.add(
        responses.POST,
        MCP_URL,
        status=200,
        json={"result": {"contents": [{"text": json.dumps(whoami)}]}},
    )


@responses.activate
def test_validate_returns_whoami_and_sends_dd_headers():
    _mock_whoami({"user_uuid": "u-1", "org_uuid": "org-1"})

    result = validate_datadog_credentials("api", "app", "datadoghq.com")

    assert result["org_uuid"] == "org-1"
    sent = responses.calls[0].request.headers
    assert sent["DD-API-KEY"] == "api"
    assert sent["DD-APPLICATION-KEY"] == "app"
    assert "Authorization" not in sent


def test_validate_rejects_invalid_site():
    # Bad site short-circuits before any HTTP call.
    with pytest.raises(IntegrationConfigurationError, match="Invalid Datadog site"):
        validate_datadog_credentials("api", "app", "not-a-site.example")


@responses.activate
def test_validate_translates_auth_error():
    responses.add(responses.POST, MCP_URL, status=403, json={"error": "forbidden"})

    with pytest.raises(IntegrationConfigurationError, match="Invalid Datadog API"):
        validate_datadog_credentials("api", "app", "datadoghq.com")


@responses.activate
def test_validate_translates_unexpected_response():
    _mock_initialize()
    responses.add(responses.POST, MCP_URL, status=200, json={"unexpected": "shape"})

    with pytest.raises(IntegrationConfigurationError, match="unexpected response"):
        validate_datadog_credentials("api", "app", "datadoghq.com")


@responses.activate
def test_validate_requires_org_uuid():
    _mock_whoami({"user_uuid": "u-1"})  # whoami omits org_uuid

    with pytest.raises(IntegrationConfigurationError, match="missing an organization"):
        validate_datadog_credentials("api", "app", "datadoghq.com")
