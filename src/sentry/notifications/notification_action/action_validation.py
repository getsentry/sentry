from typing import Any

from django.core.exceptions import ValidationError

from sentry.integrations.discord.actions.issue_alert.form import DiscordNotifyServiceForm
from sentry.integrations.jira.actions.form import JiraNotifyServiceForm
from sentry.integrations.jira_server.actions.form import JiraServerNotifyServiceForm
from sentry.integrations.msteams.actions.form import MsTeamsNotifyServiceForm
from sentry.integrations.opsgenie.actions.form import OpsgenieNotifyTeamForm
from sentry.integrations.pagerduty.actions.form import PagerDutyNotifyServiceForm
from sentry.integrations.services.integration import integration_service
from sentry.integrations.slack.actions.form import SlackNotifyServiceForm
from sentry.notifications.notification_action.registry import action_validator_registry
from sentry.rules.actions.integrations.create_ticket.form import IntegrationNotifyServiceForm
from sentry.workflow_engine.models.action import Action

from .types import BaseActionValidatorHandler


# TODO: move this to the base or refactor to use for integration actions only
def _get_integration_id(validated_data: dict[str, Any], provider: str) -> str:
    if not (integration_id := validated_data.get("integration_id")):
        raise ValidationError(f"Integration ID is required for {provider} action")
    return integration_id


@action_validator_registry.register(Action.Type.SLACK)
class SlackActionValidatorHandler(BaseActionValidatorHandler):
    provider = Action.Type.SLACK
    notify_action_form = SlackNotifyServiceForm

    def generate_action_form_data(self) -> dict[str, Any]:
        integration_id = _get_integration_id(self.validated_data, self.provider)

        return {
            "workspace": integration_id,
            "channel": self.validated_data["config"]["target_display"],
            "channel_id": self.validated_data["config"].get("target_identifier"),
            "tags": self.validated_data["data"].get("tags"),
        }

    def update_action_data(self, cleaned_data: dict[str, Any]) -> dict[str, Any]:
        self.validated_data["config"].update(
            {
                "target_display": cleaned_data["channel"],
                "target_identifier": cleaned_data["channel_id"],
            }
        )
        return self.validated_data


@action_validator_registry.register(Action.Type.MSTEAMS)
class MSTeamsActionValidatorHandler(BaseActionValidatorHandler):
    provider = Action.Type.MSTEAMS
    notify_action_form = MsTeamsNotifyServiceForm

    def generate_action_form_data(self) -> dict[str, Any]:
        integration_id = _get_integration_id(self.validated_data, self.provider)

        return {
            "team": integration_id,
            "channel": self.validated_data["config"]["target_display"],
        }

    def update_action_data(self, cleaned_data: dict[str, Any]) -> dict[str, Any]:
        self.validated_data["config"].update(
            {
                "target_display": cleaned_data["channel"],
                "target_identifier": cleaned_data["channel_id"],
            }
        )
        return self.validated_data


@action_validator_registry.register(Action.Type.DISCORD)
class DiscordActionValidatorHandler(BaseActionValidatorHandler):
    provider = Action.Type.DISCORD
    notify_action_form = DiscordNotifyServiceForm

    def generate_action_form_data(self) -> dict[str, Any]:
        integration_id = _get_integration_id(self.validated_data, self.provider)

        return {
            "server": integration_id,
            "channel_id": self.validated_data["config"]["target_identifier"],
            "tags": self.validated_data["data"].get("tags"),
        }

    def update_action_data(self, cleaned_data: dict[str, Any]) -> dict[str, Any]:
        self.validated_data["config"].update(
            {
                "target_identifier": cleaned_data["channel_id"],
            }
        )
        return self.validated_data


class TicketingActionValidatorHandler(BaseActionValidatorHandler):
    notify_action_form = IntegrationNotifyServiceForm

    def generate_action_form_data(self) -> dict[str, Any]:
        integration_id = _get_integration_id(self.validated_data, self.provider)

        return {
            "integration": integration_id,
        }

    def update_action_data(self, cleaned_data: dict[str, Any]) -> dict[str, Any]:
        return self.validated_data


@action_validator_registry.register(Action.Type.JIRA)
class JiraActionValidatorHandler(TicketingActionValidatorHandler):
    provider = Action.Type.JIRA
    notify_action_form = JiraNotifyServiceForm


@action_validator_registry.register(Action.Type.JIRA_SERVER)
class JiraServerActionValidatorHandler(TicketingActionValidatorHandler):
    provider = Action.Type.JIRA_SERVER
    notify_action_form = JiraServerNotifyServiceForm


@action_validator_registry.register(Action.Type.AZURE_DEVOPS)
class AzureDevOpsActionValidatorHandler(TicketingActionValidatorHandler):
    provider = Action.Type.AZURE_DEVOPS


@action_validator_registry.register(Action.Type.GITHUB)
class GithubActionValidatorHandler(TicketingActionValidatorHandler):
    provider = Action.Type.GITHUB


@action_validator_registry.register(Action.Type.GITHUB_ENTERPRISE)
class GithubEnterpriseActionValidatorHandler(TicketingActionValidatorHandler):
    provider = Action.Type.GITHUB_ENTERPRISE


@action_validator_registry.register(Action.Type.PAGERDUTY)
class PagerdutyActionValidatorHandler(BaseActionValidatorHandler):
    provider = Action.Type.PAGERDUTY
    notify_action_form = PagerDutyNotifyServiceForm

    def _get_services(self) -> list[tuple[int, str]]:
        organization_integrations = integration_service.get_organization_integrations(
            providers=[Action.Type.PAGERDUTY], organization_id=self.organization.id
        )
        return [
            (v["id"], v["service_name"])
            for oi in organization_integrations
            for v in oi.config.get("pagerduty_services", [])
        ]

    def generate_action_form_payload(self) -> dict[str, Any]:
        payload = super().generate_action_form_payload()

        return {
            **payload,
            "services": self._get_services(),
        }

    def generate_action_form_data(self) -> dict[str, Any]:
        integration_id = _get_integration_id(self.validated_data, self.provider)

        return {
            "account": integration_id,
            "service": self.validated_data["config"]["target_identifier"],
        }

    def update_action_data(self, cleaned_data: dict[str, Any]) -> dict[str, Any]:
        return self.validated_data


@action_validator_registry.register(Action.Type.OPSGENIE)
class OpsgenieActionValidatorHandler(BaseActionValidatorHandler):
    provider = Action.Type.OPSGENIE
    notify_action_form = OpsgenieNotifyTeamForm

    def _get_teams(self) -> list[tuple[int, str]]:
        organization_integrations = integration_service.get_organization_integrations(
            providers=[Action.Type.OPSGENIE], organization_id=self.organization.id
        )

        teams = []
        for oi in organization_integrations:
            team_table = oi.config.get("team_table")
            if team_table:
                teams += [(team["id"], team["team"]) for team in team_table]
        return teams

    def generate_action_form_payload(self) -> dict[str, Any]:
        payload = super().generate_action_form_payload()

        return {
            **payload,
            "org_id": self.organization.id,
            "teams": self._get_teams(),
        }

    def generate_action_form_data(self) -> dict[str, Any]:
        integration_id = _get_integration_id(self.validated_data, self.provider)

        return {
            "account": integration_id,
            "team": self.validated_data["config"]["target_identifier"],
        }

    def update_action_data(self, cleaned_data: dict[str, Any]) -> dict[str, Any]:
        return self.validated_data
