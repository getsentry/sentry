from sentry.notifications.notification_action.utils import execute_via_group_type_registry
from sentry.workflow_engine.models import Action, DataCondition, DataConditionGroup, Workflow
from sentry.workflow_engine.models.action import action_handler_registry
from sentry.workflow_engine.models.detector import Detector
from sentry.workflow_engine.types import ActionHandler, DetectorPriorityLevel, WorkflowEventData


@action_handler_registry.register(Action.Type.RESOLUTION_ACTION)
class ResolutionActionHandler(ActionHandler):
    group = ActionHandler.Group.OTHER

    @staticmethod
    def execute(job: WorkflowEventData, action: Action, detector: Detector) -> None:
        # get the actions for critical, then actions for warning
        workflow = Workflow.objects.get(id=job.workflow_id)
        workflow_dcgs = DataConditionGroup.objects.filter(
            workflowdataconditiongroup__workflow=workflow
        )
        warning_action_filter = DataCondition.objects.get(
            condition_group__in=workflow_dcgs,
            comparison=DetectorPriorityLevel.MEDIUM,
        )
        warning_actions = Action.objects.filter(
            dataconditiongroupaction__dataconditiongroup=warning_action_filter.condition_group
        )

        critical_action_filter = DataCondition.objects.get(
            condition_group__in=workflow_dcgs,
            comparison=DetectorPriorityLevel.HIGH,
        )
        critical_actions = Action.objects.filter(
            dataconditiongroupaction__dataconditiongroup=critical_action_filter.condition_group
        )

        # determine actions to fire based on the highest priority reached during this open period
        highest_priority = detector.config["highest_triggered_priority"]  # something like this
        if highest_priority == DetectorPriorityLevel.HIGH:
            actions_to_fire = critical_actions.union(warning_actions)
        else:
            actions_to_fire = warning_actions
        # for action in list of actions to fire, execute via group type registry
        for action_to_fire in list(actions_to_fire):
            execute_via_group_type_registry(job, action_to_fire, detector)
