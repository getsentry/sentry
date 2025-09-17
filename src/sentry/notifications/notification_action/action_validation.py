from typing import Any

from django.core.exceptions import ValidationError

from sentry.integrations.discord.actions.issue_alert.form import DiscordNotifyServiceForm
from sentry.integrations.msteams.actions.form import MsTeamsNotifyServiceForm
from sentry.integrations.slack.actions.form import SlackNotifyServiceForm
from sentry.notifications.notification_action.registry import action_validator_registry
from sentry.workflow_engine.models.action import Action

from .types import BaseActionValidatorHandler


def _get_integration_id(validated_data: dict[str, Any], provider: str) -> str:
    if not (integration_id := validated_data.get("integration_id")):
        raise ValidationError(f"Integration ID is required for {provider} action")
    return integration_id


@action_validator_registry.register(Action.Type.SLACK)
class SlackActionValidatorHandler(BaseActionValidatorHandler):
    provider = Action.Type.SLACK
    notify_action_form = SlackNotifyServiceForm

    def generate_action_form_payload(self) -> dict[str, Any]:
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

    def generate_action_form_payload(self) -> dict[str, Any]:
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

    def generate_action_form_payload(self) -> dict[str, Any]:
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
