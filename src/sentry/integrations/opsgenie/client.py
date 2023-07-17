from __future__ import annotations

from typing import Any, Mapping, Union

from requests import Response

from sentry.integrations.client import ApiClient
from sentry.models import Integration
from sentry.services.hybrid_cloud.integration.model import RpcIntegration
from sentry.shared_integrations.response.base import BaseApiResponse

OPSGENIE_API_VERSION = "v2"

# for typing purposes
BaseApiResponseX = Union[BaseApiResponse, Mapping[str, Any], Response]


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


class OpsgenieClient(ApiClient):
    integration_name = "opsgenie"

    def __init__(self, integration: RpcIntegration | Integration) -> None:
        self.integration = integration
        self.base_url = f"{self.metadata['base_url']}{OPSGENIE_API_VERSION}"
        self.api_key = self.metadata["api_key"]
        super().__init__()

    @property
    def metadata(self):
        return self.integration.metadata

    def get_team_id(self, integration_key: str, team_name: str) -> BaseApiResponseX:
        params = {"identifierType": "name"}
        path = f"/teams/{team_name}"
        headers = {"Authorization": "GenieKey " + integration_key}
        return self.get(path=path, headers=headers, params=params)
