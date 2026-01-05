from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.notification_action.utils import execute_via_group_type_registry
from sentry.notifications.types import FallthroughChoiceType
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.transformers import TargetTypeConfigTransformer
from sentry.workflow_engine.types import ActionHandler, ActionInvocation, ConfigTransformer


@action_handler_registry.register(Action.Type.EMAIL)
class EmailActionHandler(ActionHandler):
    _config_transformer: ConfigTransformer | None = None

    config_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "description": "The configuration schema for an email Action",
        "type": "object",
        "properties": {
            "target_identifier": {"type": ["string", "null"]},
            "target_display": {"type": ["null"]},
            "target_type": {
                "type": ["integer"],
                "enum": [ActionTarget.USER, ActionTarget.TEAM, ActionTarget.ISSUE_OWNERS],
            },
        },
        "required": ["target_type"],
        "additionalProperties": False,
        "allOf": [
            {
                "if": {
                    "properties": {"target_type": {"enum": [ActionTarget.USER, ActionTarget.TEAM]}}
                },
                "then": {
                    "properties": {"target_identifier": {"type": "string"}},
                    "required": ["target_type", "target_identifier"],
                },
            },
        ],
    }

    data_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
            "fallthrough_type": {
                "type": "string",
                "description": "The fallthrough type for issue owners email notifications",
                "enum": [*FallthroughChoiceType],
            },
        },
        "additionalProperties": False,
    }

    group = ActionHandler.Group.NOTIFICATION

    @classmethod
    def get_config_transformer(cls) -> ConfigTransformer | None:
        if cls._config_transformer is None:
            cls._config_transformer = TargetTypeConfigTransformer.from_config_schema(
                cls.config_schema
            )
        return cls._config_transformer

    @staticmethod
    def execute(invocation: ActionInvocation) -> None:
        execute_via_group_type_registry(invocation)
