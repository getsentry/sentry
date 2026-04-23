import logging
from abc import ABC
from typing import Any, override

from sentry.api.serializers.rest_framework.base import convert_dict_key_case, snake_to_camel_case
from sentry.integrations.types import IntegrationProviderSlug
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.notification_action.utils import execute_via_issue_alert_handler
from sentry.workflow_engine.transformers import TargetTypeConfigTransformer
from sentry.workflow_engine.types import ActionHandler, ActionInvocation, ConfigTransformer

logger = logging.getLogger(__name__)


class IntegrationActionHandler(ActionHandler, ABC):
    provider_slug: IntegrationProviderSlug


class TicketingActionHandler(IntegrationActionHandler, ABC):
    @classmethod
    def serialize_data(cls, data: dict[str, Any]) -> dict[str, Any]:
        # `additional_fields` stores third-party form field names as object
        # keys which must be preserved (e.g. {"my_field": "my value"}).
        rest = {k: v for k, v in data.items() if k != "additional_fields"}
        result: dict[str, Any] = convert_dict_key_case(rest, snake_to_camel_case)
        if "additional_fields" in data:
            result["additionalFields"] = data["additional_fields"]
        return result

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
    @override
    def execute(invocation: ActionInvocation) -> None:
        execute_via_issue_alert_handler(invocation)
