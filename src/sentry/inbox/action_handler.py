from functools import partial
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


def _inbox_calls(event_data: WorkflowEventData) -> list[partial[None]]:
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


def _require_issue_activity_with_targets(event_data: WorkflowEventData) -> None:
    _inbox_calls(event_data)


@action_handler_registry.register(Action.Type.ADD_TO_INBOX)
class AddToInboxActionHandler(ActionHandler):
    event_validators = (_require_issue_activity_with_targets,)
    group = ActionHandler.Group.OTHER
    config_schema = {"type": "object", "additionalProperties": False}
    data_schema = {"type": "object", "additionalProperties": False}

    @staticmethod
    @override
    def execute(invocation: ActionInvocation) -> None:
        first_error: Exception | None = None
        for record in _inbox_calls(invocation.event_data):
            try:
                record()
            except Exception as error:
                # Give each mention type a chance to record before the task retries.
                if first_error is None:
                    first_error = error
        if first_error is not None:
            raise first_error
