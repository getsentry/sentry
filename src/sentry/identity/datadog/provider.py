from __future__ import annotations

from typing import Any

import orjson

from sentry.auth.exceptions import IdentityNotValid
from sentry.http import safe_urlopen, safe_urlread
from sentry.identity.base import Provider
from sentry.identity.mcp import McpIdentityProvider
from sentry.identity.pipeline import IdentityPipeline
from sentry.integrations.types import IntegrationProviderSlug
from sentry.pipeline.views.base import PipelineView

DATADOG_VALID_SITES = frozenset(
    {
        "datadoghq.com",
        "us3.datadoghq.com",
        "us5.datadoghq.com",
        "datadoghq.eu",
        "ddog-gov.com",
        "us2.ddog-gov.com",
        "ap1.datadoghq.com",
        "ap2.datadoghq.com",
    }
)

MCP_ENDPOINT_PATH = "/api/unstable/mcp-server/mcp"


def get_user_info(access_token: str, site: str) -> dict[str, Any]:
    """Fetch the current Datadog user via the MCP ``datadog://mcp/whoami`` resource."""
    url = f"https://mcp.{site}{MCP_ENDPOINT_PATH}"
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}

    init_resp = safe_urlopen(
        url,
        method="POST",
        headers=headers,
        json={"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}},
    )
    init_resp.raise_for_status()
    headers["Mcp-Session-Id"] = init_resp.headers["mcp-session-id"]

    resp = safe_urlopen(
        url,
        method="POST",
        headers=headers,
        json={
            "jsonrpc": "2.0",
            "id": 2,
            "method": "resources/read",
            "params": {"uri": "datadog://mcp/whoami"},
        },
    )
    resp.raise_for_status()

    try:
        body = orjson.loads(safe_urlread(resp))
        return orjson.loads(body["result"]["contents"][0]["text"])
    except (KeyError, IndexError, orjson.JSONDecodeError) as e:
        raise IdentityNotValid("MCP whoami returned an unexpected response") from e


class DatadogIdentityProvider(McpIdentityProvider, Provider):
    key = IntegrationProviderSlug.DATADOG
    name = "Datadog"

    def get_pipeline_views(self) -> list[PipelineView[IdentityPipeline]]:
        return []

    def build_mcp_url(self, identity_data: dict[str, Any]) -> str | None:
        site = identity_data.get("site")
        if not site or site not in DATADOG_VALID_SITES:
            return None
        return f"https://mcp.{site}{MCP_ENDPOINT_PATH}"

    def build_identity(self, data: dict[str, Any]) -> dict[str, Any]:
        access_token = data.get("access_token")
        if not access_token:
            raise ValueError("Missing access token")

        site = data.get("site")
        if not site:
            raise ValueError("Missing site")
        elif site not in DATADOG_VALID_SITES:
            raise ValueError(f"Invalid site: {site}")

        user = get_user_info(access_token, site)
        if "user_uuid" not in user or "org_uuid" not in user:
            raise IdentityNotValid(
                "User info response missing required fields (user_uuid, org_uuid)"
            )

        return {
            "type": IntegrationProviderSlug.DATADOG,
            "id": user["user_uuid"],
            "idp_external_id": user["org_uuid"],
            "idp_config": {"site": site},
            "email": user.get("user_email"),
            "name": user.get("user_name"),
            "scopes": [],
            "data": {"access_token": access_token, "site": site},
        }
