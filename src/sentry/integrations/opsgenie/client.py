from __future__ import annotations

from urllib.parse import quote

from sentry.eventstore.models import Event, GroupEvent
from sentry.integrations.client import ApiClient
from sentry.models import Group, Integration
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

    def authorize_integration(self, type: str) -> BaseApiResponseX:
        body = {"type": type}
        path = "/integrations/authenticate"
        headers = {"Authorization": "GenieKey " + self.integration_key}
        return self.post(path=path, headers=headers, data=body)

    def _get_rule_urls(self, group, rules):
        organization = group.project.organization
        rule_urls = []
        for rule in rules:
            path = f"/organizations/{organization.slug}/alerts/rules/{group.project.slug}/{rule.id}/details/"
            rule_urls.append(organization.absolute_url(path))
        return rule_urls

    def _get_issue_alert_payload(self, data, rules, event: Event | GroupEvent, group: Group | None):
        payload = {
            "message": event.message or event.title,
            "source": "Sentry",
            "details": {
                "Triggering Rules": ", ".join([rule.label for rule in rules]),
                "Release": data.release,
            },
            "tags": [f'{str(x).replace(",", "")}:{str(y).replace(",", "")}' for x, y in event.tags],
        }
        if group:
            rule_urls = self._get_rule_urls(group, rules)
            payload["alias"] = f"sentry: {group.id}"
            payload["entity"] = group.culprit if group.culprit else ""
            payload["details"] = {
                "Sentry ID": str(group.id),
                "Sentry Group": getattr(group, "title", group.message).encode("utf-8"),
                "Project ID": group.project.slug,
                "Project Name": group.project.name,
                "Logger": group.logger,
                "Level": group.get_level_display(),
                "Issue URL": group.get_absolute_url(),
                "Triggering Rules": ", ".join([rule.label for rule in rules]),
                "Triggering Rule URLs": "\n".join(rule_urls),
                "Release": data.release,
            }
        return payload

    def send_notification(self, data, rules=None):
        headers = {"Authorization": "GenieKey " + self.integration_key}
        if isinstance(data, (Event, GroupEvent)):
            group = data.group
            event = data
            payload = self._get_issue_alert_payload(data, rules, event, group)
        else:
            # if we're acknowledging the alert—meaning that the Sentry alert was resolved
            if data.get("identifier"):
                alias = data["identifier"]
                resp = self.post(
                    f"/alerts/{alias}/acknowledge",
                    data={},
                    params={"identifierType": "alias"},
                    headers=headers,
                )
                return resp
            # this is a metric alert
            payload = data
        resp = self.post("/alerts", data=payload, headers=headers)
        return resp
