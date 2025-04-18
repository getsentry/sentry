from sentry.workflow_engine.models import Action
from sentry.workflow_engine.models.action import action_handler_registry
from sentry.workflow_engine.models.detector import Detector
from sentry.workflow_engine.types import ActionHandler, WorkflowEventData


@action_handler_registry.register(Action.Type.RESOLUTION_ACTION)
class ResolutionActionHandler(ActionHandler):
    group = ActionHandler.Group.OTHER

    @staticmethod
    def execute(job: WorkflowEventData, action: Action, detector: Detector) -> None:
        # get the actions for critical, then actions for warning
        # determine actions to fire based on the highest priority reached during this open period
        # for action in list of actions to fire, execute via group type registry
        pass
