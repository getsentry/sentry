from typing import Any

from django.core.exceptions import ValidationError

from sentry.integrations.services.integration.service import integration_service
from sentry.integrations.slack.actions.form import SlackNotifyServiceForm
from sentry.integrations.slack.utils.channel import get_channel_id
from sentry.notifications.notification_action.registry import action_validator_registry

from .types import BaseActionValidatorHandler


@action_validator_registry.register("slack")
class SlackActionValidatorHandler(BaseActionValidatorHandler):
    from sentry.integrations.slack.actions.notification import SlackNotifyServiceAction

    provider = "slack"
    channel_transformer = get_channel_id
    notify_action_form = SlackNotifyServiceForm

    def generate_action_form_payload(self) -> dict[str, Any]:
        if not (integration_id := self.validated_data.get("integration_id")):
            raise ValidationError("Integration ID is required for Slack action")

        integration = integration_service.get_integration(integration_id=integration_id)
        if not integration:
            raise ValidationError(f"Slack integration with id {integration_id} not found")

        return {
            "workspace": integration.name,
            "channel": self.validated_data["config"]["target_display"],
            "channel_id": self.validated_data["config"].get("target_identifier"),
            "tags": self.validated_data.get("tags"),
        }

    def update_action_data(self, cleaned_data: dict[str, Any]) -> dict[str, Any]:
        self.validated_data["config"].update(
            {
                "target_display": cleaned_data["channel"],
                "target_identifier": cleaned_data["channel_id"],
            }
        )
        return self.validated_data
