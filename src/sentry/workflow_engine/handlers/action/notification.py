from sentry.workflow_engine.models import Action, Detector
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler, WorkflowJob


@action_handler_registry.register(Action.Type.NOTIFICATION)
class NotificationActionHandler(ActionHandler):
    @staticmethod
    def execute(
        job: WorkflowJob,
        action: Action,
        detector: Detector,
    ) -> None:
        # TODO: Implment this in milestone 2
        pass
