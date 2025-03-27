from sentry.integrations.pagerduty.client import PagerdutySeverity
from sentry.workflow_engine.handlers.action.notification.base import IntegrationActionHandler
from sentry.workflow_engine.handlers.action.notification.common import ONCALL_ACTION_CONFIG_SCHEMA
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler


@action_handler_registry.register(Action.Type.PAGERDUTY)
class PagerdutyActionHandler(IntegrationActionHandler):
    group = ActionHandler.Group.NOTIFICATION
    provider_slug = "pagerduty"

    config_schema = ONCALL_ACTION_CONFIG_SCHEMA
    data_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
            "priority": {
                "type": "string",
                "description": "The priority of the pagerduty action",
                "enum": [severity for severity in PagerdutySeverity],
            },
            "additionalProperties": False,
        },
    }
