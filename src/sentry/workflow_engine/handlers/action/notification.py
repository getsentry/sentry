from sentry.eventstore.models import GroupEvent
from sentry.workflow_engine.models import Action, Detector
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler


# TODO - Enable once the PR to allow for multiple of the same funcs is merged
# @action_handler_registry.register(Action.Type.PAGERDUTY)
@action_handler_registry.register(Action.Type.SLACK)
class NotificationActionHandler(ActionHandler):
    @staticmethod
    def execute(
        evt: GroupEvent,
        action: Action,
        detector: Detector,
    ) -> None:
        # TODO: Implment this in milestone 2
        pass
