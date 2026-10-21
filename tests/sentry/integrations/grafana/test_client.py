from typing import Any

import pytest
import requests
import responses

from sentry.exceptions import RestrictedIPAddress
from sentry.integrations.grafana.client import (
    GRAFANA_STATUS_MESSAGES,
    GrafanaConnectionStatus,
    normalize_grafana_url,
    validate_grafana_connection,
    verify_grafana_connection,
)
from sentry.shared_integrations.exceptions import IntegrationConfigurationError

GRAFANA_URL = "https://example-stack.grafana.net"
HEALTH_URL = f"{GRAFANA_URL}/api/health"
DATASOURCES_URL = f"{GRAFANA_URL}/api/datasources"
DATASOURCES = [
    {"uid": "prom-uid", "name": "Prometheus", "type": "prometheus", "url": "https://prom"},
    {"uid": "loki-uid", "name": "Loki", "type": "loki", "url": "https://loki"},
]
VIEWER_PERMISSIONS = {
    "datasources:read": ["datasources:*"],
    "datasources:query": ["datasources:*"],
    "dashboards:read": ["folders:*"],
    "alert.rules:read": ["folders:*"],
    "alert.instances:read": [],
    "annotations:read": ["annotations:*"],
}


def mock_grafana(
    *,
    datasources_status: int = 200,
    datasources: Any = DATASOURCES,
    permissions: Any = VIEWER_PERMISSIONS,
) -> None:
    responses.add(responses.GET, HEALTH_URL, json={"database": "ok", "version": "13.3.0"})
    responses.add(responses.GET, DATASOURCES_URL, status=datasources_status, json=datasources)
    responses.add(
        responses.GET,
        f"{GRAFANA_URL}/api/access-control/user/permissions?reloadcache=true",
        json=permissions,
    )


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
            "https://grafana.example.com",
            "ftp://example-stack.grafana.net",
            "javascript://example-stack.grafana.net",
            "",
        ],
    )
    def test_raises_for_non_cloud_stack_url(self, url: str) -> None:
        with pytest.raises(IntegrationConfigurationError, match="Grafana Cloud URL"):
            normalize_grafana_url(url)


class TestVerifyGrafanaConnection:
    @responses.activate
    def test_returns_connected_when_token_can_read_datasources(self) -> None:
        mock_grafana()

        result = verify_grafana_connection(GRAFANA_URL, "glsa_token")

        assert result == {
            "connection_status": GrafanaConnectionStatus.CONNECTED,
            "datasources": [
                {"uid": "prom-uid", "name": "Prometheus", "type": "prometheus"},
                {"uid": "loki-uid", "name": "Loki", "type": "loki"},
            ],
            "detail": None,
        }

    @responses.activate
    def test_returns_detail_when_optional_permissions_are_missing(self) -> None:
        # Cannot read alerts or annotations.
        mock_grafana(
            permissions={
                "datasources:read": ["datasources:*"],
                "datasources:query": ["datasources:*"],
                "folders:read": ["folders:*"],
                "dashboards:read": ["folders:*"],
            }
        )

        result = verify_grafana_connection(GRAFANA_URL, "glsa_token")

        assert result["connection_status"] == GrafanaConnectionStatus.CONNECTED
        assert result["detail"] == (
            "The service account is missing these permissions, so Seer can't use that data: "
            "alert.rules:read, alert.instances:read, annotations:read."
        )

    @pytest.mark.parametrize(
        "error", [requests.exceptions.ConnectionError("boom"), RestrictedIPAddress("blocked")]
    )
    @responses.activate
    def test_returns_unreachable_when_health_fails(self, error: Exception) -> None:
        responses.add(responses.GET, HEALTH_URL, body=error)

        result = verify_grafana_connection(GRAFANA_URL, "glsa_token")

        assert result["connection_status"] == GrafanaConnectionStatus.UNREACHABLE
        assert len(responses.calls) == 1

    @responses.activate
    def test_returns_unreachable_when_health_redirects(self) -> None:
        responses.add(
            responses.GET, HEALTH_URL, status=302, headers={"Location": "https://example.com"}
        )

        result = verify_grafana_connection(GRAFANA_URL, "glsa_token")

        assert result["connection_status"] == GrafanaConnectionStatus.UNREACHABLE

    @pytest.mark.parametrize(
        ("status", "expected"),
        [
            (401, GrafanaConnectionStatus.INVALID_TOKEN),
            (403, GrafanaConnectionStatus.INSUFFICIENT_PERMISSIONS),
            (500, GrafanaConnectionStatus.ERROR),
        ],
    )
    @responses.activate
    def test_returns_status_when_datasources_request_fails(
        self, status: int, expected: GrafanaConnectionStatus
    ) -> None:
        mock_grafana(datasources_status=status, datasources={"message": "nope"})

        result = verify_grafana_connection(GRAFANA_URL, "glsa_token")

        assert result == {
            "connection_status": expected,
            "datasources": [],
            "detail": GRAFANA_STATUS_MESSAGES[expected],
        }

    @responses.activate
    def test_returns_insufficient_permissions_when_no_datasources(self) -> None:
        mock_grafana(datasources=[])

        result = verify_grafana_connection(GRAFANA_URL, "glsa_token")

        assert result["connection_status"] == GrafanaConnectionStatus.INSUFFICIENT_PERMISSIONS

    @pytest.mark.parametrize(
        ("datasources", "permissions"),
        [
            ([{"uid": "x"}], {}),
            ({"unexpected": "shape"}, {}),
            ([{"uid": "x", "name": "X", "type": "loki"}], ["dashboards:read"]),
        ],
    )
    @responses.activate
    def test_returns_error_when_response_is_malformed(
        self, datasources: object, permissions: object
    ) -> None:
        mock_grafana(datasources=datasources, permissions=permissions)

        result = verify_grafana_connection(GRAFANA_URL, "glsa_token")

        assert result["connection_status"] == GrafanaConnectionStatus.ERROR

    @responses.activate
    def test_returns_error_when_network_fails_after_health(self) -> None:
        responses.add(responses.GET, HEALTH_URL, json={"database": "ok"})
        responses.add(responses.GET, DATASOURCES_URL, body=requests.exceptions.ReadTimeout("slow"))

        result = verify_grafana_connection(GRAFANA_URL, "glsa_token")

        assert result["connection_status"] == GrafanaConnectionStatus.ERROR


class TestValidateGrafanaConnection:
    @responses.activate
    def test_returns_verification_when_connected(self) -> None:
        mock_grafana()

        result = validate_grafana_connection(GRAFANA_URL, "glsa_token")

        assert result["connection_status"] == GrafanaConnectionStatus.CONNECTED
        assert result["datasources"] == [
            {"uid": "prom-uid", "name": "Prometheus", "type": "prometheus"},
            {"uid": "loki-uid", "name": "Loki", "type": "loki"},
        ]

    @responses.activate
    def test_raises_status_message_when_not_connected(self) -> None:
        mock_grafana(datasources_status=401, datasources={"messageId": "api-key.invalid"})

        with pytest.raises(IntegrationConfigurationError, match="rejected the token"):
            validate_grafana_connection(GRAFANA_URL, "glsa_token")
