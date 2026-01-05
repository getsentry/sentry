from sentry.integrations.types import IntegrationProviderSlug
from sentry.notifications.notification_action.action_handler_registry.base import (
    IntegrationActionHandler,
)
from sentry.notifications.notification_action.action_handler_registry.common import (
    MESSAGING_ACTION_CONFIG_SCHEMA,
)
from sentry.notifications.notification_action.utils import execute_via_group_type_registry
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.transformers import TargetTypeConfigTransformer
from sentry.workflow_engine.types import ActionHandler, ActionInvocation, ConfigTransformer


@action_handler_registry.register(Action.Type.MSTEAMS)
class MSTeamsActionHandler(IntegrationActionHandler):
    group = ActionHandler.Group.NOTIFICATION
    provider_slug = IntegrationProviderSlug.MSTEAMS

    config_schema = MESSAGING_ACTION_CONFIG_SCHEMA

    data_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "description": "Schema for MSTeams action data blob",
        "properties": {},
        "additionalProperties": False,
    }

    @staticmethod
    def get_config_transformer() -> ConfigTransformer | None:
        return TargetTypeConfigTransformer.from_config_schema(MSTeamsActionHandler.config_schema)

    @staticmethod
    def execute(invocation: ActionInvocation) -> None:
        execute_via_group_type_registry(invocation)
