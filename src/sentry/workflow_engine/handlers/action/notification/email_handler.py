from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.notification_action.utils import execute_via_group_type_registry
from sentry.workflow_engine.models import Action, Detector
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler, WorkflowEventData


@action_handler_registry.register(Action.Type.EMAIL)
class EmailActionHandler(ActionHandler):
    config_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "description": "The configuration schema for an email Action",
        "type": "object",
        "properties": {
            "target_identifier": {"type": ["string", "null"]},
            "target_display": {"type": ["null"]},
            "target_type": {
                "type": ["integer"],
                "enum": [*ActionTarget],
            },
        },
        "required": ["target_type"],
        "additionalProperties": False,
    }
    data_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "properties": {
            "fallthroughType": {
                "type": "string",
                "description": "The fallthrough type for issue owners email notifications",
            },
        },
        "additionalProperties": False,
    }

    group = ActionHandler.Group.NOTIFICATION

    @staticmethod
    def execute(
        job: WorkflowEventData,
        action: Action,
        detector: Detector,
    ) -> None:
        execute_via_group_type_registry(job, action, detector)
