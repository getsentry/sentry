from __future__ import annotations

import logging
from typing import cast

import sentry_sdk

from sentry.integrations.opsgenie.actions import OpsgenieNotifyTeamForm
from sentry.integrations.opsgenie.client import OPSGENIE_DEFAULT_PRIORITY, OpsgeniePriority
from sentry.integrations.opsgenie.utils import get_team
from sentry.integrations.services.integration import integration_service
from sentry.rules.actions import IntegrationEventAction
from sentry.shared_integrations.exceptions import ApiError

logger = logging.getLogger("sentry.integrations.opsgenie")


class OpsgenieNotifyTeamAction(IntegrationEventAction):
    id = "sentry.integrations.opsgenie.notify_action.OpsgenieNotifyTeamAction"
    form_cls = OpsgenieNotifyTeamForm
    label = (
        "Send a notification to Opsgenie account {account} and team {team} with {priority} priority"
    )
    prompt = "Send an Opsgenie notification"
    provider = "opsgenie"
    integration_key = "account"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.form_fields = {
            "account": {
                "type": "choice",
                "choices": [(i.id, i.name) for i in self.get_integrations()],
            },
            "team": {"type": "choice", "choices": self.get_teams()},
            "priority": {
                "type": "choice",
                "choices": [("P1", "P1"), ("P2", "P2"), ("P3", "P3"), ("P4", "P4"), ("P5", "P5")],
            },
        }

    def after(self, event, notification_uuid: str | None = None):
        integration = self.get_integration()
        if not integration:
            logger.error("Integration removed, but the rule still refers to it")
            return

        org_integration = self.get_organization_integration()
        if not org_integration:
            logger.error("No associated org integration.")
            return

        team = get_team(self.get_option("team"), org_integration)

        priority = cast(
            OpsgeniePriority, self.get_option("priority", default=OPSGENIE_DEFAULT_PRIORITY)
        )

        if not team:
            logger.error(
                "The Opsgenie team no longer exists, or the team does not belong to the selected account."
            )
            return

        def send_notification(event, futures):
            installation = integration.get_installation(self.project.organization_id)
            try:
                client = installation.get_keyring_client(self.get_option("team"))
            except Exception as e:
                sentry_sdk.capture_exception(e)
                return
            try:
                rules = [f.rule for f in futures]
                resp = client.send_notification(
                    data=event,
                    priority=priority,
                    rules=rules,
                    notification_uuid=notification_uuid,
                )
            except ApiError as e:
                logger.info(
                    "rule.fail.opsgenie_notification",
                    extra={
                        "error": str(e),
                        "team_name": team["team"],
                        "team_id": team["id"],
                        "project_id": event.project_id,
                        "event_id": event.event_id,
                    },
                )
                raise

            logger.info(
                "rule.success.opsgenie_notification",
                extra={
                    "status_code": resp.status_code,
                    "project_id": event.project_id,
                    "event_id": event.event_id,
                    "team_name": team["team"],
                    "team_id": team["id"],
                },
            )
            rule = rules[0] if rules else None
            self.record_notification_sent(event, team["id"], rule, notification_uuid)

        key = f"opsgenie:{integration.id}:{team['id']}:{priority}"
        yield self.future(send_notification, key=key)

    def get_teams(self) -> list[tuple[str, str]]:
        organization_integrations = integration_service.get_organization_integrations(
            providers=[self.provider], organization_id=self.project.organization_id
        )

        teams = []
        for oi in organization_integrations:
            team_table = oi.config.get("team_table")
            if team_table:
                teams += [(team["id"], team["team"]) for team in team_table]
        return teams

    def render_label(self) -> str:
        team = get_team(self.get_option("team"), self.get_organization_integration())
        team_name = team["team"] if team else "[removed]"
        priority = self.get_option("priority", default=OPSGENIE_DEFAULT_PRIORITY)

        return self.label.format(
            account=self.get_integration_name(), team=team_name, priority=priority
        )

    def get_form_instance(self):
        return self.form_cls(
            self.data,
            org_id=self.project.organization_id,
            integrations=self.get_integrations(),
            teams=self.get_teams(),
        )
