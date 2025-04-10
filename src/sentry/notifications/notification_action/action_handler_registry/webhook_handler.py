from sentry.notifications.notification_action.utils import execute_via_group_type_registry
from sentry.workflow_engine.models import Action, Detector
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler, WorkflowEventData


@action_handler_registry.register(Action.Type.WEBHOOK)
class WebhookActionHandler(ActionHandler):
    group = ActionHandler.Group.OTHER

    config_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "description": "The configuration schema for Webhook Actions",
        "type": "object",
        "properties": {
            "target_identifier": {
                "type": ["string"],
            },
            "target_display": {
                "type": ["null"],
            },
            "target_type": {
                "type": ["integer", "null"],
                "enum": [None],
            },
        },
    }
    data_schema = {}

    @staticmethod
    def execute(
        job: WorkflowEventData,
        action: Action,
        detector: Detector,
    ) -> None:
        execute_via_group_type_registry(job, action, detector)
