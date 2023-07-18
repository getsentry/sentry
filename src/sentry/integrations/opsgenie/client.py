from __future__ import annotations

from urllib.parse import quote

from sentry.integrations.client import ApiClient
from sentry.models import Integration
from sentry.services.hybrid_cloud.integration.model import RpcIntegration
from sentry.shared_integrations.client.base import BaseApiResponseX
from sentry.shared_integrations.client.proxy import IntegrationProxyClient

OPSGENIE_API_VERSION = "v2"


class OpsgenieSetupClient(ApiClient):
    """
    API Client that doesn't require an installation.
    This client is used during integration setup to fetch data
    needed to build installation metadata
    """

    integration_name = "opsgenie_setup"

    def __init__(self, base_url: str, api_key: str) -> None:
        super().__init__()
        self.base_url = f"{base_url}{OPSGENIE_API_VERSION}"
        self.api_key = api_key

    def get_account(self):
        headers = {"Authorization": "GenieKey " + self.api_key}
        return self.get(path="/account", headers=headers)


class OpsgenieClient(IntegrationProxyClient):
    integration_name = "opsgenie"

    def __init__(
        self, integration: RpcIntegration | Integration, org_integration_id: int | None
    ) -> None:
        self.integration = integration
        self.base_url = f"{self.metadata['base_url']}{OPSGENIE_API_VERSION}"
        self.api_key = self.metadata["api_key"]
        super().__init__(org_integration_id=org_integration_id)

    @property
    def metadata(self):
        return self.integration.metadata

    # This doesn't work if the team name is "." or "..", which Opsgenie allows for some reason
    # despite their API not working with these names.
    def get_team_id(self, integration_key: str, team_name: str) -> BaseApiResponseX:
        params = {"identifierType": "name"}
        quoted_name = quote(team_name)
        path = f"/teams/{quoted_name}"
        headers = {"Authorization": "GenieKey " + integration_key}
        return self.get(path=path, headers=headers, params=params)
