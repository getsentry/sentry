from sentry.eventstore.models import GroupEvent
from sentry.workflow_engine.models import Action, Detector
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler


@action_handler_registry.register(Action.Type.NOTIFICATION)
class NotificationActionHandler(ActionHandler):
    @staticmethod
    def execute(
        evt: GroupEvent,
        action: Action,
        detector: Detector,
    ) -> None:
        # TODO: Implment this in milestone 2
        pass
