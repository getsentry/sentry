from __future__ import annotations

from typing import Any

import orjson

from sentry.auth.exceptions import IdentityNotValid
from sentry.http import safe_urlopen, safe_urlread
from sentry.identity.base import Provider
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


def get_user_info(access_token: str, mcp_base_url: str) -> dict[str, Any]:
    """Fetch the current Datadog user via the MCP ``datadog://mcp/whoami`` resource."""
    url = f"{mcp_base_url}{MCP_ENDPOINT_PATH}"
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


class DatadogIdentityProvider(Provider):
    """Datadog connects via a user-supplied read-only access token (PAT).

    Datadog's MCP OAuth flow only accepts loopback redirect URIs, so a hosted
    integration like Sentry can't use it. Instead the user creates a scoped,
    read-only access token in Datadog and submits it directly; we validate it
    and store it as an identity. The token is a Bearer credential for the MCP
    server, identical in shape to what an OAuth flow would have produced.
    """

    key = IntegrationProviderSlug.DATADOG
    name = "Datadog"
    auto_create_provider_model = True

    def get_pipeline_config(self, data: dict[str, Any]) -> dict[str, str]:
        site = data.get("site")
        if not site:
            raise ValueError("Datadog requires a 'site' parameter (e.g. 'datadoghq.com').")
        elif site not in DATADOG_VALID_SITES:
            raise ValueError(f"Invalid Datadog site: {site}")
        return {"site": site}

    def get_pipeline_views(self) -> list[PipelineView[IdentityPipeline]]:
        return []

    def _get_mcp_base_url(self, site: str) -> str:
        if site not in DATADOG_VALID_SITES:
            raise ValueError(f"Invalid Datadog site: {site}")
        return f"https://mcp.{site}"

    def build_identity(self, data: dict[str, Any]) -> dict[str, Any]:
        access_token = data.get("access_token")
        if not access_token:
            raise ValueError("Datadog requires an access token")

        site = data.get("site")
        if not site:
            raise ValueError("Datadog requires a 'site' parameter (e.g. 'datadoghq.com').")
        elif site not in DATADOG_VALID_SITES:
            raise ValueError(f"Invalid Datadog site: {site}")

        user = get_user_info(access_token, self._get_mcp_base_url(site))
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
