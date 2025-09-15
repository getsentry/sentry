from typing import Any

from django.core.exceptions import ValidationError

from sentry.constants import ObjectStatus
from sentry.integrations.msteams.actions.form import MsTeamsNotifyServiceForm
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.services.integration.service import integration_service
from sentry.integrations.slack.actions.form import SlackNotifyServiceForm
from sentry.notifications.notification_action.registry import action_validator_registry
from sentry.workflow_engine.models.action import Action

from .types import BaseActionValidatorHandler


def _get_integration(validated_data: dict[str, Any], provider: str) -> RpcIntegration:
    if not (integration_id := validated_data.get("integration_id")):
        raise ValidationError(f"Integration ID is required for {provider} action")

    integration = integration_service.get_integration(
        integration_id=integration_id, status=ObjectStatus.ACTIVE
    )
    if not integration:
        raise ValidationError(f"{provider} integration with id {integration_id} not found")
    return integration


@action_validator_registry.register(Action.Type.SLACK)
class SlackActionValidatorHandler(BaseActionValidatorHandler):
    provider = Action.Type.SLACK
    notify_action_form = SlackNotifyServiceForm

    def generate_action_form_payload(self) -> dict[str, Any]:
        integration = _get_integration(self.validated_data, self.provider)

        return {
            "workspace": integration.id,
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
        integration = _get_integration(self.validated_data, self.provider)

        return {
            "team": integration.id,
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
