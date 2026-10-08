from __future__ import annotations

import logging
from collections.abc import Sequence
from typing import Literal

from sentry.integrations.client import ApiClient
from sentry.integrations.models.integration import Integration
from sentry.integrations.on_call.metrics import OnCallInteractionType
from sentry.integrations.opsgenie.metrics import record_event, record_lifecycle_termination_level
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.group import Group
from sentry.models.rule import Rule
from sentry.notifications.types import TEST_NOTIFICATION_ID
from sentry.notifications.utils.links import create_link_to_workflow
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.shared_integrations.exceptions import ApiError

OPSGENIE_API_VERSION = "v2"
# Defaults to P3 if null, but we can be explicit - https://docs.opsgenie.com/docs/alert-api
OPSGENIE_DEFAULT_PRIORITY = "P3"

OpsgeniePriority = Literal["P1", "P2", "P3", "P4", "P5"]

logger = logging.getLogger("sentry.integrations.opsgenie")


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

    def _get_workflow_links(self, group: Group, rules: Sequence[Rule]) -> list[tuple[str, str]]:
        """
        Returns (label, url) pairs for each rule that carries a workflow id.
        """
        organization = group.project.organization
        links = []
        for rule in rules:
            action = rule.data.get("actions", [{}])[0]
            workflow_id = action.get("workflow_id")
            if workflow_id is None:
                # Test notifications have no backing workflow, so nothing to link to.
                if action.get("legacy_rule_id") != TEST_NOTIFICATION_ID:
                    logger.warning(
                        "opsgenie.issue_alert.missing_workflow_id",
                        extra={
                            "rule_id": rule.id,
                            "legacy_rule_id": action.get("legacy_rule_id"),
                            "group_id": group.id,
                            "project_id": group.project_id,
                            "organization_id": organization.id,
                        },
                    )
                continue
            links.append(
                (
                    rule.label,
                    organization.absolute_url(
                        create_link_to_workflow(organization.slug, str(workflow_id))
                    ),
                )
            )
        return links

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
            "tags": [f"{str(x).replace(',', '')}:{str(y).replace(',', '')}" for x, y in event.tags],
        }
        if group:
            payload["alias"] = f"sentry: {group.id}"
            payload["entity"] = group.culprit if group.culprit else ""
            group_params = {"referrer": IntegrationProviderSlug.OPSGENIE.value}
            if notification_uuid:
                group_params["notification_uuid"] = notification_uuid

            workflow_links = self._get_workflow_links(group, rules)
            rule_workflow_context = {}
            if workflow_links:
                rule_workflow_context = {
                    "Triggering Workflows": ", ".join(label for label, _ in workflow_links),
                    "Triggering Workflow URLs": "\n".join(url for _, url in workflow_links),
                }

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
