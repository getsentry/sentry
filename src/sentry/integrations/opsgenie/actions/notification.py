from __future__ import annotations

import logging

from sentry.integrations.opsgenie.actions import OpsgenieNotifyTeamForm
from sentry.integrations.opsgenie.client import OpsgenieClient
from sentry.rules.actions import IntegrationEventAction
from sentry.services.hybrid_cloud.integration.model import RpcOrganizationIntegration
from sentry.shared_integrations.client.proxy import infer_org_integration
from sentry.shared_integrations.exceptions import ApiError

logger = logging.getLogger("sentry.integrations.opsgenie")


class OpsgenieNotifyTeamAction(IntegrationEventAction):
    id = "opsgenie.integrations.opsgenie.notify_action.OpsgenieNotifyTeamAction"
    form_cls = OpsgenieNotifyTeamForm
    label = "Send a notification to Opsgenie account {account} and team {team}"
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
        }

    def _get_team(self, org_integration: RpcOrganizationIntegration):
        teams = org_integration.config.get("team_table")
        if not teams:
            return None
        team_id = self.get_option("team")
        for team in teams:
            if team["id"] == team_id:
                return team
        return None

    def after(self, event, state):
        integration = self.get_integration()
        if not integration:
            logger.exception("Integration removed, but the rule still refers to it")
            return

        org_integration = self.get_organization_integration()
        team = self._get_team(org_integration)
        if not team:
            logger.exception(
                "The Opsgenie team no longer exists, or the team does not belong to the selected account."
            )
            return

        def send_notification(event, futures):
            org_integration = self.get_organization_integration()
            org_integration_id = None
            if org_integration:
                org_integration_id = org_integration.id
            else:
                org_integration_id = infer_org_integration(
                    integration_id=integration.id, ctx_logger=logger
                )
            client = OpsgenieClient(
                integration=integration,
                org_integration_id=org_integration_id,
                integration_key=team["integration_key"],
            )
            try:
                rules = [f.rule for f in futures]
                resp = client.send_notification(event, rules)
            except ApiError as e:
                self.logger.info(
                    "rule.fail.opsgenie_notification",
                    extra={
                        "error": str(e),
                        "team_name": team["team"],
                        "team_id": team["id"],
                        "project_id": event.project_id,
                        "event_id": event.event_id,
                    },
                )
                raise e

            self.logger.info(
                "rule.success.opsgenie_notification",
                extra={
                    "status_code": resp.status_code,
                    "project_id": event.project_id,
                    "event_id": event.event_id,
                    "team_name": team["team"],
                    "team_id": team["id"],
                },
            )

        key = f"opsgenie:{integration.id}:{team['id']}"
        yield self.future(send_notification, key=key)

    def get_teams(self) -> list[dict]:
        from sentry.services.hybrid_cloud.integration import integration_service

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
        team = self._get_team(self.get_organization_integration())
        if team:
            team_name = team["team"]
        else:
            team_name = "[removed]"

        return self.label.format(account=self.get_integration_name(), team=team_name)

    def get_form_instance(self):
        return self.form_cls(
            self.data,
            integrations=self.get_integrations(),
            teams=self.get_teams(),
        )
