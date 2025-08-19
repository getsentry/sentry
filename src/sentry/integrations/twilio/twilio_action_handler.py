from sentry.integrations.twilio.integration import TwilioApiClient
from sentry.integrations.types import IntegrationProviderSlug
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.notification_action.action_handler_registry.base import (
    IntegrationActionHandler,
)
from sentry.workflow_engine.models import Action, Detector
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler, WorkflowEventData


@action_handler_registry.register(Action.Type.TWILIO)
class TwilioActionHandler(IntegrationActionHandler):
    group = ActionHandler.Group.NOTIFICATION
    provider_slug = IntegrationProviderSlug.TWILIO

    config_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "description": "The configuration schema for a Twilio Action",
        "type": "object",
        "properties": {
            "target_identifier": {"type": ["string"]},
            "target_display": {"type": ["null"]},
            "target_type": {
                "type": ["integer"],
                "enum": [ActionTarget.SPECIFIC.value],
            },
        },
        "required": ["target_identifier", "target_type"],
        "additionalProperties": False,
    }

    data_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "description": "Schema for Twilio action data blob",
        "properties": {},
        "additionalProperties": False,
    }

    @staticmethod
    def execute(
        job: WorkflowEventData,
        action: Action,
        detector: Detector,
    ) -> None:
        client = TwilioApiClient(action.integration)

        body = "Hello, this is a test message from Sentry."

        client.send_sms(action.target_identifier, body)
