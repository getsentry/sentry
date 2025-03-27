from sentry.notifications.notification_action.utils import execute_via_group_type_registry
from sentry.workflow_engine.handlers.action.notification.base import ActionHandler
from sentry.workflow_engine.handlers.action.notification.common import GENERIC_ACTION_CONFIG_SCHEMA
from sentry.workflow_engine.models import Action, Detector
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import WorkflowEventData


@action_handler_registry.register(Action.Type.PLUGIN)
class PluginActionHandler(ActionHandler):
    group = ActionHandler.Group.NOTIFICATION

    config_schema = GENERIC_ACTION_CONFIG_SCHEMA
    data_schema = {}

    @staticmethod
    def execute(
        job: WorkflowEventData,
        action: Action,
        detector: Detector,
    ) -> None:
        execute_via_group_type_registry(job, action, detector)
