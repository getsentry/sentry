from sentry.integrations.opsgenie.utils import OPSGENIE_CUSTOM_PRIORITIES
from sentry.integrations.types import IntegrationProviderSlug
from sentry.workflow_engine.handlers.action.notification.base import IntegrationActionHandler
from sentry.workflow_engine.handlers.action.notification.common import ONCALL_ACTION_CONFIG_SCHEMA
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler


@action_handler_registry.register(Action.Type.OPSGENIE)
class OpsgenieActionHandler(IntegrationActionHandler):
    group = ActionHandler.Group.NOTIFICATION
    provider_slug = IntegrationProviderSlug.OPSGENIE

    config_schema = ONCALL_ACTION_CONFIG_SCHEMA
    data_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
            "priority": {
                "type": "string",
                "description": "The priority of the opsgenie action",
                "enum": [*OPSGENIE_CUSTOM_PRIORITIES],
            },
            "additionalProperties": False,
        },
    }
