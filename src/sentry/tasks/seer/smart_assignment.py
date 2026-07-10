"""Async entrypoints for the smart assignment feature.

Event hooks (the workflow activity handler and the post_process new-issue job)
enqueue these tasks so gating + the Seer feature dispatch stay off the hot path.
"""

from __future__ import annotations

import logging

from sentry.models.group import Group
from sentry.models.groupassignee import GroupAssignee
from sentry.seer.models.smart_assignment import SmartAssignmentTrigger
from sentry.seer.smart_assignment.trigger import (
    maybe_trigger_smart_assignment,
    record_ground_truth,
)
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks

logger = logging.getLogger(__name__)


def _current_assignee_user_id(group: Group) -> int | None:
    """The user (not team) currently assigned to `group`, if any."""
    assignee = GroupAssignee.objects.filter(group=group).first()
    return assignee.user_id if assignee is not None else None


@instrumented_task(
    name="sentry.tasks.seer.smart_assignment.process_smart_assignment",
    namespace=seer_tasks,
    processing_deadline_duration=2 * 60,
)
def process_smart_assignment(
    group_id: int,
    trigger: str,
    actor_user_id: int | None = None,
) -> None:
    """Trigger a prediction for `group` (deduped/gated) and capture ground truth.

    The prediction is attempted first so that, when an assignment or resolution is
    itself the first trigger, the row it creates is immediately annotated with the
    observed ground truth.
    """
    group = Group.objects.filter(id=group_id).first()
    if group is None:
        return

    try:
        trigger_enum = SmartAssignmentTrigger(trigger)
    except ValueError:
        logger.warning("smart_assignment.task.invalid_trigger", extra={"trigger": trigger})
        return

    maybe_trigger_smart_assignment(group, trigger_enum)

    if trigger_enum == SmartAssignmentTrigger.ASSIGNMENT:
        assignee_user_id = _current_assignee_user_id(group)
        if assignee_user_id is not None:
            record_ground_truth(group, assignee_user_id=assignee_user_id)
    elif trigger_enum == SmartAssignmentTrigger.RESOLUTION:
        if actor_user_id is not None:
            record_ground_truth(group, resolver_user_id=actor_user_id)
