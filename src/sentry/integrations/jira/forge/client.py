from __future__ import annotations

from typing import Any

from sentry.integrations.client import ApiClient
from sentry.integrations.utils.jira import get_jira_key

# Atlassian's reserved, read-only app property holding the site's Connect clientKey.
# It stops being served at Connect end of support.
# https://developer.atlassian.com/platform/adopting-forge-from-connect/migrate-connect-clientkey/
CONNECT_CLIENT_KEY_PROPERTY = "connect_client_key_019cdff3-8bfb-71fe-9628-875b700aebb8"


class ForgeInstallationClient(ApiClient):
    integration_name = "jira"
    timeout = 10
    allow_redirects = False

    def get_connect_client_key(self, api_base_url: str, system_token: str) -> str:
        result = self.get(
            f"{api_base_url}/rest/atlassian-connect/1/addons/{get_jira_key()}/properties/{CONNECT_CLIENT_KEY_PROPERTY}",
            headers={"Authorization": f"Bearer {system_token}"},
        )
        client_key = result.get("value")
        if not isinstance(client_key, str) or not client_key or len(client_key) > 256:
            raise ValueError("Invalid Connect client key response")
        return client_key

    def get_server_info(self, api_base_url: str, system_token: str) -> dict[str, Any]:
        return self.get(
            f"{api_base_url}/rest/api/3/serverInfo",
            headers={"Authorization": f"Bearer {system_token}"},
        )
