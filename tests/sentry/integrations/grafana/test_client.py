import pytest

from sentry.integrations.grafana.client import normalize_grafana_url
from sentry.shared_integrations.exceptions import IntegrationConfigurationError

GRAFANA_URL = "https://example-stack.grafana.net"


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
