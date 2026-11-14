from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from requests import PreparedRequest

from sentry.integrations.client import ApiClient
from sentry.integrations.utils.jira import get_jira_key
from sentry.shared_integrations.exceptions import ApiError

# Atlassian's reserved, read-only app property holding the site's Connect clientKey.
# It stops being served at Connect end of support.
# https://developer.atlassian.com/platform/adopting-forge-from-connect/migrate-connect-clientkey/
CONNECT_CLIENT_KEY_PROPERTY = "connect_client_key_019cdff3-8bfb-71fe-9628-875b700aebb8"


class ForgeTokenClient(ApiClient):
    """Calls a site's Jira API through Atlassian's API gateway with a Forge OAuth token."""

    integration_name = "jira"
    timeout = 10
    allow_redirects = False

    def __init__(self, api_base_url: str, token: str) -> None:
        self.base_url = api_base_url
        self.token = token
        super().__init__()

    def finalize_request(self, prepared_request: PreparedRequest) -> PreparedRequest:
        prepared_request.headers["Authorization"] = f"Bearer {self.token}"
        return prepared_request


class ForgeInstallationClient(ForgeTokenClient):
    """
    Calls a site's Jira API with its Forge system token while its integration is still
    being found or created. Once it exists, JiraCloudClient makes the calls.
    """

    def get_connect_client_key(self) -> str:
        result = self.get(
            f"/rest/atlassian-connect/1/addons/{get_jira_key()}/properties/{CONNECT_CLIENT_KEY_PROPERTY}"
        )
        client_key = result.get("value")
        if not isinstance(client_key, str) or not client_key or len(client_key) > 256:
            raise ValueError("Invalid Connect client key response")
        return client_key

    def get_server_info(self) -> dict[str, Any]:
        return self.get("/rest/api/3/serverInfo")


class ForgeUserClient(ForgeTokenClient):
    """Calls a site's Jira API as the user in a Forge invocation, with their user token."""

    def is_jira_admin(self) -> bool:
        try:
            result = self.get("/rest/api/3/mypermissions", params={"permissions": "ADMINISTER"})
        except ValueError as e:
            # A body that isn't JSON, such as a gateway error page.
            raise ApiError("Unexpected Jira permissions response") from e
        permissions = result.get("permissions") if isinstance(result, Mapping) else None
        permission = permissions.get("ADMINISTER") if isinstance(permissions, Mapping) else None
        if not isinstance(permission, Mapping):
            raise ApiError("Unexpected Jira permissions response")
        return permission.get("havePermission") is True
