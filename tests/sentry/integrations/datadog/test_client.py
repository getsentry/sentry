import pytest
import requests
import responses

from sentry.exceptions import RestrictedIPAddress
from sentry.integrations.datadog.client import validate_datadog_credentials
from sentry.shared_integrations.exceptions import IntegrationConfigurationError

CURRENT_USER_URL = "https://api.datadoghq.com/api/v2/current_user"


@responses.activate
def test_validate_returns_org_uuid_and_sends_dd_headers() -> None:
    responses.add(
        responses.GET,
        CURRENT_USER_URL,
        status=200,
        json={"data": {"relationships": {"org": {"data": {"id": "org-1"}}}}},
    )

    result = validate_datadog_credentials("api", "app", "datadoghq.com")

    assert result == "org-1"
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
    responses.add(responses.GET, CURRENT_USER_URL, status=403, json={"errors": ["forbidden"]})

    with pytest.raises(IntegrationConfigurationError, match="Invalid Datadog API"):
        validate_datadog_credentials("api", "app", "datadoghq.com")


@responses.activate
def test_validate_translates_network_error() -> None:
    responses.add(responses.GET, CURRENT_USER_URL, body=requests.exceptions.ConnectionError("boom"))

    with pytest.raises(IntegrationConfigurationError, match="Could not reach Datadog"):
        validate_datadog_credentials("api", "app", "datadoghq.com")


@responses.activate
def test_validate_translates_restricted_ip() -> None:
    responses.add(responses.GET, CURRENT_USER_URL, body=RestrictedIPAddress("blocked"))

    with pytest.raises(IntegrationConfigurationError, match="Could not reach Datadog"):
        validate_datadog_credentials("api", "app", "datadoghq.com")


@responses.activate
def test_validate_translates_unexpected_response() -> None:
    responses.add(responses.GET, CURRENT_USER_URL, status=200, json={"unexpected": "shape"})

    with pytest.raises(IntegrationConfigurationError, match="unexpected response"):
        validate_datadog_credentials("api", "app", "datadoghq.com")
