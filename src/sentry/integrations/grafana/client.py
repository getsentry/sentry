from __future__ import annotations

from enum import StrEnum
from typing import Any, TypedDict
from urllib.parse import urlsplit

import orjson
from requests import HTTPError, RequestException

from sentry.exceptions import RestrictedIPAddress
from sentry.http import safe_urlopen, safe_urlread
from sentry.shared_integrations.exceptions import IntegrationConfigurationError


class GrafanaConnectionStatus(StrEnum):
    CONNECTED = "connected"
    UNREACHABLE = "unreachable"
    INVALID_TOKEN = "invalid_token"
    INSUFFICIENT_PERMISSIONS = "insufficient_permissions"
    ERROR = "error"


GRAFANA_STATUS_MESSAGES: dict[GrafanaConnectionStatus, str] = {
    GrafanaConnectionStatus.UNREACHABLE: "Could not reach Grafana. Check the URL and try again.",
    GrafanaConnectionStatus.INVALID_TOKEN: "Grafana rejected the token. Check that it is an active service account token.",
    GrafanaConnectionStatus.INSUFFICIENT_PERMISSIONS: "The service account can't read any data sources. Give it the Viewer role, or the Data sources Reader role.",
    GrafanaConnectionStatus.ERROR: "Something went wrong while checking the connection to Grafana. Please try again.",
}

# Permissions Seer may use beyond querying data sources.
GRAFANA_OPTIONAL_PERMISSIONS: tuple[str, ...] = (
    "dashboards:read",
    "alert.rules:read",
    "alert.instances:read",
    "annotations:read",
)


class GrafanaDatasource(TypedDict):
    uid: str
    name: str
    type: str


class GrafanaVerification(TypedDict):
    connection_status: GrafanaConnectionStatus
    datasources: list[GrafanaDatasource]
    detail: str | None


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


def _fetch_json(url: str, token: str | None = None) -> Any:
    headers = {"Accept": "application/json"}
    if token is not None:
        headers["Authorization"] = f"Bearer {token}"
    resp = safe_urlopen(url, method="GET", headers=headers)
    resp.raise_for_status()
    return orjson.loads(safe_urlread(resp))


def _failed(status: GrafanaConnectionStatus) -> GrafanaVerification:
    return {
        "connection_status": status,
        "datasources": [],
        "detail": GRAFANA_STATUS_MESSAGES[status],
    }


def verify_grafana_connection(url: str, token: str) -> GrafanaVerification:
    """Check that the stack is reachable and the token can read data sources. Never raises."""
    try:
        _fetch_json(f"{url}/api/health")
    except (RestrictedIPAddress, RequestException, orjson.JSONDecodeError):
        return _failed(GrafanaConnectionStatus.UNREACHABLE)

    try:
        datasources = _fetch_json(f"{url}/api/datasources", token)
        permissions = _fetch_json(
            f"{url}/api/access-control/user/permissions?reloadcache=true", token
        )
    except HTTPError as e:
        status = e.response.status_code if e.response is not None else None
        if status == 401:
            return _failed(GrafanaConnectionStatus.INVALID_TOKEN)
        if status == 403:
            return _failed(GrafanaConnectionStatus.INSUFFICIENT_PERMISSIONS)
        return _failed(GrafanaConnectionStatus.ERROR)
    except (RestrictedIPAddress, RequestException, orjson.JSONDecodeError):
        return _failed(GrafanaConnectionStatus.ERROR)

    try:
        sources: list[GrafanaDatasource] = [
            {"uid": ds["uid"], "name": ds["name"], "type": ds["type"]} for ds in datasources
        ]
    except (KeyError, TypeError):
        return _failed(GrafanaConnectionStatus.ERROR)
    if not sources:
        return _failed(GrafanaConnectionStatus.INSUFFICIENT_PERMISSIONS)

    if not isinstance(permissions, dict):
        return _failed(GrafanaConnectionStatus.ERROR)
    # Missing optional permissions are warnings, not failures; Grafana returns empty
    # results instead of 403s for them.
    missing = [action for action in GRAFANA_OPTIONAL_PERMISSIONS if action not in permissions]
    detail = (
        f"The service account is missing these permissions, so Seer can't use that data: "
        f"{', '.join(missing)}."
        if missing
        else None
    )

    return {
        "connection_status": GrafanaConnectionStatus.CONNECTED,
        "datasources": sources,
        "detail": detail,
    }


def validate_grafana_connection(url: str, token: str) -> GrafanaVerification:
    """Wrapper for verify_grafana_connection that raises unless the connection is healthy."""
    verification = verify_grafana_connection(url, token)
    if verification["connection_status"] != GrafanaConnectionStatus.CONNECTED:
        raise IntegrationConfigurationError(verification["detail"])
    return verification
