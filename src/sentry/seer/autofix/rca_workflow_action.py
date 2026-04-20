from django.contrib.auth.models import AnonymousUser

from sentry.seer.autofix.autofix import trigger_autofix
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.services.eventstore.models import GroupEvent
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.models.data_condition_group_action import DataConditionGroupAction
from sentry.workflow_engine.models.workflow_data_condition_group import WorkflowDataConditionGroup
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler, ActionInvocation


def _get_workflow_creator_user(action: Action) -> RpcUser | AnonymousUser:
    """
    Resolve the user who created the workflow that owns this action.
    Falls back to AnonymousUser if the chain cannot be resolved.
    """
    dcg_action = DataConditionGroupAction.objects.filter(action=action).first()
    if dcg_action is None:
        return AnonymousUser()

    created_by_id = (
        WorkflowDataConditionGroup.objects.filter(condition_group=dcg_action.condition_group)
        .values_list("workflow__created_by_id", flat=True)
        .first()
    )

    if created_by_id is None:
        return AnonymousUser()

    rpc_user = user_service.get_user(user_id=created_by_id)
    if rpc_user is None:
        return AnonymousUser()

    return rpc_user


@action_handler_registry.register(Action.Type.SEER_RCA)
class SeerRootCauseHandler(ActionHandler):
    group = ActionHandler.Group.SEER
    config_schema = {}
    data_schema = {}

    @staticmethod
    def execute(invocation: ActionInvocation) -> None:
        group = invocation.event_data.group
        event = invocation.event_data.event
        user = _get_workflow_creator_user(invocation.action)

        event_id = event.event_id if isinstance(event, GroupEvent) else None

        # TODO - we could proxy information from the description into the fix.
        trigger_autofix(
            group=group,
            event_id=event_id,
            user=user,
            referrer=AutofixReferrer.WORKFLOW_ACTION,
            stopping_point=AutofixStoppingPoint.ROOT_CAUSE,  # TODO - could make this configurable on the action
        )
