import logging
from abc import ABC

from sentry.integrations.types import IntegrationProviderSlug
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.notification_action.utils import execute_via_issue_alert_handler
from sentry.workflow_engine.transformers import TargetTypeConfigTransformer
from sentry.workflow_engine.types import ActionHandler, ActionInvocation, ConfigTransformer

logger = logging.getLogger(__name__)


class IntegrationActionHandler(ActionHandler, ABC):
    provider_slug: IntegrationProviderSlug


class TicketingActionHandler(IntegrationActionHandler, ABC):
    config_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "description": "The configuration schema for a Ticketing Action",
        "type": "object",
        "properties": {
            "target_identifier": {
                "type": ["null"],
            },
            "target_display": {
                "type": ["null"],
            },
            "target_type": {
                "type": ["integer"],
                "enum": [ActionTarget.SPECIFIC.value],
            },
        },
    }

    data_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "description": "Schema for ticket creation action data blob",
        "properties": {
            "dynamic_form_fields": {
                "type": "array",
                "description": "Dynamic form fields from customer configuration",
                "items": {"type": "object"},
                "default": [],
            },
            "additional_fields": {
                "type": "object",
                "description": "Additional fields that aren't part of standard fields",
                "additionalProperties": True,
                "default": {},
            },
        },
        "additionalProperties": False,
    }

    @staticmethod
    def get_config_transformer() -> ConfigTransformer | None:
        return TargetTypeConfigTransformer.from_config_schema(TicketingActionHandler.config_schema)

    @staticmethod
    def execute(invocation: ActionInvocation) -> None:
        execute_via_issue_alert_handler(invocation)
