from collections.abc import Callable
from typing import override

from sentry.inbox.issue_activity import issue_activity_inbox_calls
from sentry.models.activity import Activity
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import (
    ActionHandler,
    ActionInvocation,
    UnsupportedActionEvent,
    WorkflowEventData,
)


def _inbox_calls(event_data: WorkflowEventData) -> list[Callable[[], None]]:
    activity = event_data.event
    group = event_data.group
    if (
        not isinstance(activity, Activity)
        or activity.id is None
        or group is None
        or activity.group_id != group.id
        or activity.project_id != group.project_id
    ):
        raise UnsupportedActionEvent("Inbox issue activities require their own issue group")
    calls = list(issue_activity_inbox_calls(activity, group))
    if not calls:
        raise UnsupportedActionEvent("Activity has no supported Inbox targets")
    return calls


@action_handler_registry.register(Action.Type.ADD_TO_INBOX)
class AddToInboxActionHandler(ActionHandler):
    group = ActionHandler.Group.OTHER
    config_schema = {"type": "object", "additionalProperties": False}
    data_schema = {"type": "object", "additionalProperties": False}

    @staticmethod
    @override
    def validate_event_data(event_data: WorkflowEventData) -> None:
        _inbox_calls(event_data)

    @staticmethod
    @override
    def execute(invocation: ActionInvocation) -> None:
        for record in _inbox_calls(invocation.event_data):
            record()
