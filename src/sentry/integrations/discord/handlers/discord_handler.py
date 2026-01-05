from sentry.integrations.types import IntegrationProviderSlug
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.notification_action.action_handler_registry.base import (
    IntegrationActionHandler,
)
from sentry.notifications.notification_action.action_handler_registry.common import TAGS_SCHEMA
from sentry.notifications.notification_action.utils import execute_via_group_type_registry
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.transformers import TargetTypeConfigTransformer
from sentry.workflow_engine.types import ActionHandler, ActionInvocation, ConfigTransformer


@action_handler_registry.register(Action.Type.DISCORD)
class DiscordActionHandler(IntegrationActionHandler):
    group = ActionHandler.Group.NOTIFICATION
    provider_slug = IntegrationProviderSlug.DISCORD

    # Main difference between the discord and slack action config schemas is that the target_display is possibly null
    config_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "description": "The configuration schema for a Discord Action",
        "type": "object",
        "properties": {
            "target_identifier": {"type": "string"},
            "target_display": {
                "type": ["string", "null"],
            },
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
        "description": "Schema for Discord action data blob",
        "properties": {
            "tags": TAGS_SCHEMA,
        },
        "additionalProperties": False,
    }

    @staticmethod
    def get_config_transformer() -> ConfigTransformer | None:
        return TargetTypeConfigTransformer.from_config_schema(DiscordActionHandler.config_schema)

    @staticmethod
    def execute(invocation: ActionInvocation) -> None:
        execute_via_group_type_registry(invocation)
