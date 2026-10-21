from __future__ import annotations

from urllib.parse import urlsplit

from sentry.shared_integrations.exceptions import IntegrationConfigurationError


def normalize_grafana_url(url: str) -> str:
    """Return ``https://<stack>.grafana.net``, or raise.

    The token is sent to this host. Therefore only Grafana Cloud stacks are allowed: one subdomain
    of grafana.net, and no port or credentials.
    """
    url = url.strip()
    if "://" not in url:
        url = f"https://{url}"
    parts = urlsplit(url)
    host = (parts.hostname or "").lower()
    stack = host.removesuffix(".grafana.net")
    if (
        parts.scheme.lower() not in ("http", "https")
        # A netloc that differs from the host means a port or userinfo was included.
        or parts.netloc.lower() != host
        or stack == host
        # The stack must be a plain [a-z0-9-] label, so no escaping or unicode can turn it into
        # another host.
        or not stack.isascii()
        or not stack.replace("-", "").isalnum()
    ):
        raise IntegrationConfigurationError(
            "Enter your Grafana Cloud URL, like https://your-stack.grafana.net."
        )
    return f"https://{host}"
