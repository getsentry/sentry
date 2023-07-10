from __future__ import annotations

from sentry.shared_integrations.client.proxy import IntegrationProxyClient

# from typing import Any, Mapping


API_VERSION = "/v2"


class OpsgenieProxySetupClient(IntegrationProxyClient):
    """
    API Client that doesn't require an installation.
    This client is used during integration setup to fetch data
    needed to build installation metadata
    """

    integration_name = "opsgenie_setup"

    def __init__(self, base_url: str, api_key: str) -> None:
        super().__init__()
        self.base_url = base_url.rstrip()  # remove trailing spaces
        self.api_key = api_key

    @staticmethod
    def build_api_url(base_url, path):
        return "{}{}{}".format(base_url.rstrip("/"), API_VERSION, path)

    def build_url(self, path: str) -> str:
        path = self.build_api_url(self.base_url, path)
        return super().build_url(path=path)

    def get_account(self):
        headers = {"Authorization": "GenieKey " + self.api_key}
        return self._request(path="/account", method="get", headers=headers)
