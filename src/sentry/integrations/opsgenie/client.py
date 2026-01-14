from __future__ import annotations

from typing import Literal

from sentry.integrations.client import ApiClient
from sentry.integrations.models.integration import Integration
from sentry.integrations.on_call.metrics import OnCallInteractionType
from sentry.integrations.opsgenie.metrics import record_event, record_lifecycle_termination_level
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.group import Group
from sentry.notifications.notification_action.utils import should_fire_workflow_actions
from sentry.notifications.utils.links import create_link_to_workflow
from sentry.notifications.utils.rules import get_key_from_rule_data, split_rules_by_rule_workflow_id
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.shared_integrations.exceptions import ApiError

OPSGENIE_API_VERSION = "v2"
# Defaults to P3 if null, but we can be explicit - https://docs.opsgenie.com/docs/alert-api
OPSGENIE_DEFAULT_PRIORITY = "P3"

OpsgeniePriority = Literal["P1", "P2", "P3", "P4", "P5"]


class OpsgenieClient(ApiClient):
    integration_name = IntegrationProviderSlug.OPSGENIE.value

    def __init__(self, integration: RpcIntegration | Integration, integration_key: str) -> None:
        self.integration = integration
        self.base_url = f"{self.metadata['base_url']}{OPSGENIE_API_VERSION}"
        self.integration_key = integration_key
        super().__init__(integration_id=self.integration.id)

    @property
    def metadata(self):
        return self.integration.metadata

    def _get_auth_headers(self):
        return {"Authorization": f"GenieKey {self.integration_key}"}

    def get_alerts(self, limit: int | None = 1) -> object | None:
        path = f"/alerts?limit={limit}"
        return self.get(path=path, headers=self._get_auth_headers())

    def _get_workflow_urls(self, group, rules):
        organization = group.project.organization
        workflow_urls = []
        for rule in rules:
            # fetch the workflow_id from the rule.data
            workflow_id = get_key_from_rule_data(rule, "workflow_id")
            workflow_urls.append(
                organization.absolute_url(create_link_to_workflow(organization.slug, workflow_id))
            )
        return workflow_urls

    def _get_rule_urls(self, group, rules):
        organization = group.project.organization
        rule_urls = []
        for rule in rules:
            rule_id = rule.id
            if should_fire_workflow_actions(organization, group.type):
                rule_id = get_key_from_rule_data(rule, "legacy_rule_id")

            path = f"/organizations/{organization.slug}/alerts/rules/{group.project.slug}/{rule_id}/details/"
            rule_urls.append(organization.absolute_url(path))
        return rule_urls

    def build_issue_alert_payload(
        self,
        data,
        rules,
        event: Event | GroupEvent,
        group: Group | None,
        priority: OpsgeniePriority | None = "P3",
        notification_uuid: str | None = None,
    ):
        payload = {
            "message": event.message or event.title,
            "source": "Sentry",
            "priority": priority,
            "details": {
                "Triggering Rules": ", ".join([rule.label for rule in rules]),
                "Release": data.release,
            },
            "tags": [f'{str(x).replace(",", "")}:{str(y).replace(",", "")}' for x, y in event.tags],
        }
        if group:
            payload["alias"] = f"sentry: {group.id}"
            payload["entity"] = group.culprit if group.culprit else ""
            group_params = {"referrer": IntegrationProviderSlug.OPSGENIE.value}
            if notification_uuid:
                group_params["notification_uuid"] = notification_uuid

            rules_and_workflows = split_rules_by_rule_workflow_id(rules)
            workflow_urls = self._get_workflow_urls(group, rules_and_workflows.workflow_rules)
            rule_urls = self._get_rule_urls(group, rules_and_workflows.rules)
            rule_workflow_context = {}
            if rule_urls:
                rule_workflow_context.update(
                    {
                        "Triggering Rules": ", ".join(
                            [rule.label for rule in rules_and_workflows.rules]
                        ),
                        "Triggering Rule URLs": "\n".join(rule_urls),
                    }
                )
            if workflow_urls:
                rule_workflow_context.update(
                    {
                        "Triggering Workflows": ", ".join(
                            [workflow.label for workflow in rules_and_workflows.workflow_rules]
                        ),
                        "Triggering Workflow URLs": "\n".join(workflow_urls),
                    }
                )

            payload["details"] = {
                "Sentry ID": str(group.id),
                "Sentry Group": getattr(group, "title", group.message).encode("utf-8"),
                "Project ID": group.project.slug,
                "Project Name": group.project.name,
                "Logger": group.logger,
                "Level": group.get_level_display(),
                "Issue URL": group.get_absolute_url(params=group_params),
                "Release": data.release,
                **rule_workflow_context,
            }
        return payload

    def send_notification(self, data):
        headers = self._get_auth_headers()
        with record_event(OnCallInteractionType.CREATE).capture() as lifecycle:
            try:
                return self.post("/alerts", data=data, headers=headers)
            except ApiError as e:
                record_lifecycle_termination_level(lifecycle=lifecycle, error=e)
                raise

    # TODO(iamrajjoshi): We need to delete this method during notification platform
    def send_metric_alert_notification(self, data):
        headers = self._get_auth_headers()

        # If closing an alert (when Sentry alert was resolved)
        if data.get("identifier"):
            alias = data["identifier"]
            with record_event(OnCallInteractionType.RESOLVE).capture() as lifecycle:
                try:
                    return self.post(
                        f"/alerts/{alias}/close",
                        data={},
                        params={"identifierType": "alias"},
                        headers=headers,
                    )
                except ApiError as e:
                    record_lifecycle_termination_level(lifecycle=lifecycle, error=e)
                    raise

        # Creating a metric alert
        with record_event(OnCallInteractionType.CREATE).capture() as lifecycle:
            try:
                return self.post("/alerts", data=data, headers=headers)
            except ApiError as e:
                record_lifecycle_termination_level(lifecycle=lifecycle, error=e)
                raise
