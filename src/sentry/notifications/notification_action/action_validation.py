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
from sentry.models.organization import Organization
from sentry.notifications.notification_action.registry import action_validator_registry
from sentry.rules.actions.integrations.create_ticket.form import IntegrationNotifyServiceForm
from sentry.rules.actions.notify_event_service import NotifyEventServiceForm
from sentry.rules.actions.sentry_apps.utils import validate_sentry_app_action
from sentry.sentry_apps.services.app import RpcSentryAppInstallation, app_service
from sentry.sentry_apps.utils.errors import SentryAppBaseError
from sentry.utils import json
from sentry.workflow_engine.models.action import Action
from sentry.workflow_engine.processors.action import get_notification_plugins_for_org
from sentry.workflow_engine.typings.notification_action import SentryAppIdentifier

from .types import BaseActionValidatorHandler


@action_validator_registry.register(Action.Type.SLACK)
class SlackActionValidatorHandler(BaseActionValidatorHandler):
    provider = Action.Type.SLACK
    notify_action_form = SlackNotifyServiceForm

    def generate_action_form_data(self) -> dict[str, Any]:
        return {
            "workspace": self.validated_data["integration_id"],
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
        return {
            "team": self.validated_data["integration_id"],
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
        return {
            "server": self.validated_data["integration_id"],
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
        return {
            "integration": self.validated_data["integration_id"],
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
        return {
            "account": self.validated_data["integration_id"],
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
        return {
            "account": self.validated_data["integration_id"],
            "team": self.validated_data["config"]["target_identifier"],
        }

    def update_action_data(self, cleaned_data: dict[str, Any]) -> dict[str, Any]:
        return self.validated_data


@action_validator_registry.register(Action.Type.SENTRY_APP)
class SentryAppActionValidatorHandler:
    provider = Action.Type.SENTRY_APP

    def __init__(self, validated_data: dict[str, Any], organization: Organization) -> None:
        self.validated_data = validated_data
        self.organization = organization

    def _get_sentry_app_installation(
        self, sentry_app_identifier: SentryAppIdentifier, target_identifier: str
    ) -> RpcSentryAppInstallation | None:
        """
        Get the sentry app installation based on whether the target identifier is an installation id or sentry app id
        We do not want to accept SentryAppIdentifier.SENTRY_APP_INSTALLATION_UUID long term, this is temporary until we migrate the data over
        """
        installations = None
        installation = None

        if sentry_app_identifier == SentryAppIdentifier.SENTRY_APP_INSTALLATION_UUID:
            installations = app_service.get_many(
                filter=dict(uuids=[target_identifier], organization_id=self.organization.id)
            )
        else:
            installations = app_service.get_many(
                filter=dict(app_ids=[int(target_identifier)], organization_id=self.organization.id)
            )
        if installations:
            installation = installations[0]

        return installation

    def clean_data(self) -> dict[str, Any]:
        sentry_app_identifier = SentryAppIdentifier(
            self.validated_data["config"]["sentry_app_identifier"]
        )
        target_identifier = self.validated_data["config"]["target_identifier"]
        installation = self._get_sentry_app_installation(sentry_app_identifier, target_identifier)
        if not installation:
            raise ValidationError("Sentry app installation not found.")

        if sentry_app_identifier == SentryAppIdentifier.SENTRY_APP_INSTALLATION_UUID:
            # convert to use sentry_app_id until we can migrate all the data
            self.validated_data["config"][
                "sentry_app_identifier"
            ] = SentryAppIdentifier.SENTRY_APP_ID
            self.validated_data["config"]["target_identifier"] = str(installation.sentry_app.id)

        settings = self.validated_data["data"].get("settings", [])
        action = {
            "settings": settings,
            "sentryAppInstallationUuid": installation.uuid,
        }

        if not settings:
            # XXX: it's only ok to not pass settings if there is no sentry app schema
            # this means the app doesn't expect any settings
            components = app_service.find_app_components(app_id=installation.sentry_app.id)
            if any(
                component.app_schema
                for component in components
                if component.type == "alert-rule-action"
            ):
                raise ValidationError("'settings' is a required property")

        else:
            # Sentry app config blob expects value to be a string
            for setting in settings:
                if setting.get("value") is not None and not isinstance(setting["value"], str):
                    setting["value"] = json.dumps(setting["value"])
            try:
                # Only call creator for Sentry Apps with UI Components (settings) for actions
                validate_sentry_app_action(action)
            except SentryAppBaseError as e:
                raise ValidationError(e.message) from e

        return self.validated_data


@action_validator_registry.register(Action.Type.WEBHOOK)
class WebhookActionValidatorHandler(BaseActionValidatorHandler):
    provider = Action.Type.WEBHOOK
    notify_action_form = NotifyEventServiceForm

    def _get_services(self) -> list[Any]:
        plugins = get_notification_plugins_for_org(self.organization)
        sentry_apps = app_service.find_alertable_services(organization_id=self.organization.id)
        return [
            *plugins,
            *sentry_apps,
        ]

    def generate_action_form_payload(self) -> dict[str, Any]:
        return {
            "services": self._get_services(),
            "data": self.generate_action_form_data(),
        }

    def generate_action_form_data(self) -> dict[str, Any]:
        return {
            "service": self.validated_data["config"]["target_identifier"],
        }

    def update_action_data(self, cleaned_data: dict[str, Any]) -> dict[str, Any]:
        return self.validated_data
