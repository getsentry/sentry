from typing import Any

import pytest
import requests
import responses

from sentry.exceptions import RestrictedIPAddress
from sentry.integrations.grafana.client import (
    GRAFANA_ERROR_MESSAGE,
    GRAFANA_INSUFFICIENT_PERMISSIONS_MESSAGE,
    GRAFANA_INVALID_TOKEN_MESSAGE,
    GRAFANA_UNREACHABLE_MESSAGE,
    normalize_grafana_url,
    validate_grafana_connection,
)
from sentry.shared_integrations.exceptions import IntegrationConfigurationError

GRAFANA_URL = "https://example-stack.grafana.net"
HEALTH_URL = f"{GRAFANA_URL}/api/health"
DATASOURCES_URL = f"{GRAFANA_URL}/api/datasources"
DATASOURCES = [
    {"uid": "prom-uid", "name": "Prometheus", "type": "prometheus", "url": "https://prom"},
    {"uid": "loki-uid", "name": "Loki", "type": "loki", "url": "https://loki"},
]


def mock_grafana(
    *,
    datasources_status: int = 200,
    datasources: Any = DATASOURCES,
) -> None:
    responses.add(responses.GET, HEALTH_URL, json={"database": "ok", "version": "13.3.0"})
    responses.add(responses.GET, DATASOURCES_URL, status=datasources_status, json=datasources)


class TestNormalizeGrafanaUrl:
    @pytest.mark.parametrize(
        "url",
        [
            "https://example-stack.grafana.net",
            "https://example-stack.grafana.net/",
            "  https://Example-Stack.Grafana.NET  ",
            "HTTPS://example-stack.grafana.net",
            "https://example-stack.grafana.net/d/abc123/my-dash?orgId=1&from=now-6h#panel-2",
            "https://example-stack.grafana.net/explore?left=%7B%22datasource%22%7D",
            "example-stack.grafana.net",
            "example-stack.grafana.net/d/abc123",
            "http://example-stack.grafana.net",
        ],
    )
    def test_returns_canonical_url_for_cloud_stack_url(self, url: str) -> None:
        assert normalize_grafana_url(url) == GRAFANA_URL

    @pytest.mark.parametrize(
        "url",
        [
            "https://example-stack.grafana.net:8443",
            "example-stack.grafana.net:8443",
            "https://user:pass@example-stack.grafana.net",
            "https://attacker.example\\@example-stack.grafana.net",
            "https://grafana.net",
            "https://.grafana.net",
            "https://a.b.grafana.net",
            "https://example-stack.grafana.net.attacker.example",
            "https://example-stack.grafana.net.",
            "https://attacker%2eexample%2f.grafana.net",
            "https://exаmple-stack.grafana.net",
            "https://ex_ample.grafana.net",
            "https://[example-stack.grafana.net",
            "https://[example-stack.grafana.net]",
            "https://example-stack.grafana.net：443",
            "https://grafana.example.com",
            "ftp://example-stack.grafana.net",
            "javascript://example-stack.grafana.net",
            "",
        ],
    )
    def test_raises_for_non_cloud_stack_url(self, url: str) -> None:
        with pytest.raises(IntegrationConfigurationError, match="Grafana Cloud URL"):
            normalize_grafana_url(url)


class TestValidateGrafanaConnection:
    @responses.activate
    def test_passes_when_token_can_read_datasources(self) -> None:
        mock_grafana()

        validate_grafana_connection(GRAFANA_URL, "glsa_token")

        assert responses.calls[1].request.headers["Authorization"] == "Bearer glsa_token"

    @pytest.mark.parametrize(
        "error", [requests.exceptions.ConnectionError("boom"), RestrictedIPAddress("blocked")]
    )
    @responses.activate
    def test_raises_unreachable_when_health_fails(self, error: Exception) -> None:
        responses.add(responses.GET, HEALTH_URL, body=error)

        with pytest.raises(IntegrationConfigurationError) as excinfo:
            validate_grafana_connection(GRAFANA_URL, "glsa_token")

        assert str(excinfo.value) == GRAFANA_UNREACHABLE_MESSAGE
        assert len(responses.calls) == 1

    @responses.activate
    def test_raises_unreachable_when_health_redirects(self) -> None:
        responses.add(
            responses.GET, HEALTH_URL, status=302, headers={"Location": "https://example.com"}
        )

        with pytest.raises(IntegrationConfigurationError) as excinfo:
            validate_grafana_connection(GRAFANA_URL, "glsa_token")

        assert str(excinfo.value) == GRAFANA_UNREACHABLE_MESSAGE

    @pytest.mark.parametrize(
        ("status", "message"),
        [
            (401, GRAFANA_INVALID_TOKEN_MESSAGE),
            (403, GRAFANA_INSUFFICIENT_PERMISSIONS_MESSAGE),
            (500, GRAFANA_ERROR_MESSAGE),
        ],
    )
    @responses.activate
    def test_raises_when_datasources_request_fails(self, status: int, message: str) -> None:
        mock_grafana(datasources_status=status, datasources={"message": "nope"})

        with pytest.raises(IntegrationConfigurationError) as excinfo:
            validate_grafana_connection(GRAFANA_URL, "glsa_token")

        assert str(excinfo.value) == message

    @responses.activate
    def test_raises_insufficient_permissions_when_no_datasources(self) -> None:
        mock_grafana(datasources=[])

        with pytest.raises(IntegrationConfigurationError) as excinfo:
            validate_grafana_connection(GRAFANA_URL, "glsa_token")

        assert str(excinfo.value) == GRAFANA_INSUFFICIENT_PERMISSIONS_MESSAGE

    @responses.activate
    def test_raises_error_when_response_is_malformed(self) -> None:
        mock_grafana(datasources={"unexpected": "shape"})

        with pytest.raises(IntegrationConfigurationError) as excinfo:
            validate_grafana_connection(GRAFANA_URL, "glsa_token")

        assert str(excinfo.value) == GRAFANA_ERROR_MESSAGE

    @responses.activate
    def test_raises_error_when_network_fails_after_health(self) -> None:
        responses.add(responses.GET, HEALTH_URL, json={"database": "ok"})
        responses.add(responses.GET, DATASOURCES_URL, body=requests.exceptions.ReadTimeout("slow"))

        with pytest.raises(IntegrationConfigurationError) as excinfo:
            validate_grafana_connection(GRAFANA_URL, "glsa_token")

        assert str(excinfo.value) == GRAFANA_ERROR_MESSAGE
