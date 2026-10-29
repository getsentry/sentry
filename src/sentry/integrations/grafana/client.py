from __future__ import annotations

from typing import Any
from urllib.parse import urlsplit

import orjson
from requests import HTTPError, RequestException

from sentry.exceptions import RestrictedIPAddress
from sentry.http import safe_urlopen, safe_urlread
from sentry.shared_integrations.exceptions import IntegrationConfigurationError

GRAFANA_INVALID_URL_MESSAGE = "Enter your Grafana Cloud URL, like https://your-stack.grafana.net."
GRAFANA_UNREACHABLE_MESSAGE = "Could not reach Grafana. Check the URL and try again."
GRAFANA_INVALID_TOKEN_MESSAGE = (
    "Grafana rejected the token. Check that it is an active service account token."
)
GRAFANA_INSUFFICIENT_PERMISSIONS_MESSAGE = (
    "The service account can't read any data sources. "
    "Give it the Viewer role, or the Data sources Reader role."
)
GRAFANA_ERROR_MESSAGE = (
    "Something went wrong while checking the connection to Grafana. Please try again."
)


def normalize_grafana_url(url: str) -> str:
    """Return ``https://<stack>.grafana.net``, or raise.

    The token is sent to this host. Therefore only Grafana Cloud stacks are allowed: one subdomain
    of grafana.net, and no port or credentials.
    """
    url = url.strip()
    if "://" not in url:
        url = f"https://{url}"
    try:
        parts = urlsplit(url)
        host = (parts.hostname or "").lower()
    except ValueError as e:
        raise IntegrationConfigurationError(GRAFANA_INVALID_URL_MESSAGE) from e
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
        raise IntegrationConfigurationError(GRAFANA_INVALID_URL_MESSAGE)
    return f"https://{host}"


def _fetch_json(url: str, token: str | None = None) -> Any:
    headers = {"Accept": "application/json"}
    if token is not None:
        headers["Authorization"] = f"Bearer {token}"
    resp = safe_urlopen(url, method="GET", headers=headers)
    resp.raise_for_status()
    return orjson.loads(safe_urlread(resp))


def validate_grafana_connection(url: str, token: str) -> None:
    """Check that the stack is reachable and the token can read data sources, or raise."""
    try:
        _fetch_json(f"{url}/api/health")
    except (RestrictedIPAddress, RequestException, orjson.JSONDecodeError):
        raise IntegrationConfigurationError(GRAFANA_UNREACHABLE_MESSAGE)

    try:
        datasources = _fetch_json(f"{url}/api/datasources", token)
    except HTTPError as e:
        status = e.response.status_code if e.response is not None else None
        if status == 401:
            raise IntegrationConfigurationError(GRAFANA_INVALID_TOKEN_MESSAGE)
        if status == 403:
            raise IntegrationConfigurationError(GRAFANA_INSUFFICIENT_PERMISSIONS_MESSAGE)
        raise IntegrationConfigurationError(GRAFANA_ERROR_MESSAGE)
    except (RestrictedIPAddress, RequestException, orjson.JSONDecodeError):
        raise IntegrationConfigurationError(GRAFANA_ERROR_MESSAGE)

    if not isinstance(datasources, list):
        raise IntegrationConfigurationError(GRAFANA_ERROR_MESSAGE)
    if not datasources:
        raise IntegrationConfigurationError(GRAFANA_INSUFFICIENT_PERMISSIONS_MESSAGE)
