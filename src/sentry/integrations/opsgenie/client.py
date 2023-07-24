from __future__ import annotations

from urllib.parse import quote

from sentry.eventstore.models import Event, GroupEvent
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
        self,
        integration: RpcIntegration | Integration,
        integration_key: str,
        org_integration_id: int | None,
    ) -> None:
        self.integration = integration
        self.base_url = f"{self.metadata['base_url']}{OPSGENIE_API_VERSION}"
        self.integration_key = integration_key
        super().__init__(org_integration_id=org_integration_id)

    @property
    def metadata(self):
        return self.integration.metadata

    # This doesn't work if the team name is "." or "..", which Opsgenie allows for some reason
    # despite their API not working with these names.
    def get_team_id(self, team_name: str) -> BaseApiResponseX:
        params = {"identifierType": "name"}
        quoted_name = quote(team_name)
        path = f"/teams/{quoted_name}"
        headers = {"Authorization": "GenieKey " + self.integration_key}
        return self.get(path=path, headers=headers, params=params)

    def send_notification(self, data, rules=None):
        headers = {"Authorization": "GenieKey " + self.integration_key}
        if isinstance(data, (Event, GroupEvent)):
            group = data.group
            event = data
            # If we're sending an event alert, there will always be rules. This is just to be safe.
            triggering_rules = ", ".join([rule.label for rule in rules]) if rules else ""
            payload = {
                "message": event.message or event.title,
                "alias": f"sentry: {group.id}",
                "source": "Sentry",
                "details": {
                    "Sentry ID": str(group.id),
                    "Sentry Group": getattr(group, "title", group.message).encode("utf-8"),
                    "Project ID": group.project.slug,
                    "Project Name": group.project.name,
                    "Logger": group.logger,
                    "Level": group.get_level_display(),
                    "URL": group.get_absolute_url(),
                    "Triggering Rules": triggering_rules,
                    "Release": data.release,
                },
                "entity": group.culprit,
                "tags": [
                    f'{str(x).replace(",", "")}:{str(y).replace(",", "")}' for x, y in event.tags
                ],
            }

        else:
            # this is a metric alert
            payload = data
            # if we're acknowledging the alert
            if payload.get("identifier"):
                return self.post(
                    "/alerts/:identifier/acknowledge", data={}, params=payload, headers=headers
                )
        return self.post("/alerts", data=payload, headers=headers)
