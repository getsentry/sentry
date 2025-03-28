from sentry.notifications.notification_action.utils import execute_via_group_type_registry
from sentry.workflow_engine.handlers.action.notification.common import (
    EMAIL_ACTION_CONFIG_SCHEMA,
    EMAIL_ACTION_DATA_SCHEMA,
)
from sentry.workflow_engine.models import Action, Detector
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler, WorkflowEventData


@action_handler_registry.register(Action.Type.EMAIL)
class EmailActionHandler(ActionHandler):
    config_schema = EMAIL_ACTION_CONFIG_SCHEMA
    data_schema = EMAIL_ACTION_DATA_SCHEMA
    group = ActionHandler.Group.NOTIFICATION

    @staticmethod
    def execute(
        job: WorkflowEventData,
        action: Action,
        detector: Detector,
    ) -> None:
        execute_via_group_type_registry(job, action, detector)
