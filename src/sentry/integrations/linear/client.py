from __future__ import annotations

from typing import Any, TypedDict

import orjson
from requests import RequestException

from sentry.exceptions import RestrictedIPAddress
from sentry.http import safe_urlopen, safe_urlread
from sentry.shared_integrations.exceptions import IntegrationConfigurationError

LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql"
# This endpoint only exposes read tools, whatever the API key itself is allowed to do.
# See https://linear.app/docs/mcp.
LINEAR_MCP_URL = "https://mcp.linear.app/mcp/readonly"

LINEAR_UNREACHABLE_MESSAGE = "Could not reach Linear. Please try again."
LINEAR_INVALID_API_KEY_MESSAGE = (
    "Linear rejected the API key. Check that it is an active personal API key."
)
LINEAR_INSUFFICIENT_PERMISSIONS_MESSAGE = (
    "The API key can't read your Linear workspace. Give it the Read permission."
)
LINEAR_ERROR_MESSAGE = (
    "Something went wrong while checking the connection to Linear. Please try again."
)

_WORKSPACE_QUERY = "query SentrySeerConnectionCheck { organization { id name } }"


class LinearWorkspace(TypedDict):
    id: str
    name: str


def _errors(body: Any) -> list[Any]:
    errors = body.get("errors") if isinstance(body, dict) else None
    return errors if isinstance(errors, list) else []


def _error_codes(errors: list[Any]) -> set[str]:
    return {
        error["extensions"]["code"]
        for error in errors
        if isinstance(error, dict)
        and isinstance(error.get("extensions"), dict)
        and isinstance(error["extensions"].get("code"), str)
    }


def _workspace(body: Any) -> LinearWorkspace | None:
    data = body.get("data") if isinstance(body, dict) else None
    organization = data.get("organization") if isinstance(data, dict) else None
    if not isinstance(organization, dict):
        return None
    workspace_id = organization.get("id")
    name = organization.get("name")
    if not (isinstance(workspace_id, str) and workspace_id and isinstance(name, str) and name):
        return None
    return {"id": workspace_id, "name": name}


def validate_linear_api_key(api_key: str) -> LinearWorkspace:
    """Check that the API key can read its Linear workspace, and return the workspace, or raise."""
    try:
        resp = safe_urlopen(
            LINEAR_GRAPHQL_URL,
            method="POST",
            json={"query": _WORKSPACE_QUERY},
            # Linear takes personal API keys without the "Bearer" prefix that OAuth tokens use.
            headers={"Accept": "application/json", "Authorization": api_key},
        )
    except (RestrictedIPAddress, RequestException):
        raise IntegrationConfigurationError(LINEAR_UNREACHABLE_MESSAGE)

    # GraphQL reports failures in the body, so read it whatever the status is.
    try:
        body = orjson.loads(safe_urlread(resp))
    except orjson.JSONDecodeError:
        body = None

    errors = _errors(body)
    codes = _error_codes(errors)
    if resp.status_code == 401 or "AUTHENTICATION_ERROR" in codes:
        raise IntegrationConfigurationError(LINEAR_INVALID_API_KEY_MESSAGE)
    if resp.status_code == 403 or "FORBIDDEN" in codes:
        raise IntegrationConfigurationError(LINEAR_INSUFFICIENT_PERMISSIONS_MESSAGE)

    workspace = _workspace(body)
    # The query reads a single object, so any error means the check didn't pass.
    if resp.status_code != 200 or errors or workspace is None:
        raise IntegrationConfigurationError(LINEAR_ERROR_MESSAGE)
    return workspace
