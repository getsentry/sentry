from collections.abc import Sequence
from typing import Any

from sentry.models.group import Group
from sentry.models.groupassignee import GroupAssignee
from sentry.notifications.types import AssigneeTargetType
from sentry.utils.cache import cache
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowJob


@condition_handler_registry.register(Condition.ASSIGNED_TO)
class AssignedToConditionHandler(DataConditionHandler[WorkflowJob]):
    type = [DataConditionHandler.Type.ACTION_FILTER]

    comparison_json_schema = {
        "type": "object",
        "properties": {
            "target_type": {"type": "string", "enum": [*AssigneeTargetType]},
            "target_identifier": {"type": ["integer", "string"]},
        },
        "required": ["target_type", "target_identifier"],
        "additionalProperties": False,
    }

    @staticmethod
    def get_assignees(group: Group) -> Sequence[GroupAssignee]:
        cache_key = f"group:{group.id}:assignees"
        assignee_list: Sequence[GroupAssignee] | None = cache.get(cache_key)
        if assignee_list is None:
            assignee_list = list(group.assignee_set.all())
            cache.set(cache_key, assignee_list, 60)
        return assignee_list

    @staticmethod
    def evaluate_value(job: WorkflowJob, comparison: Any) -> bool:
        event = job["event"]
        target_type = AssigneeTargetType(comparison.get("target_type"))
        assignees = AssignedToConditionHandler.get_assignees(event.group)

        if target_type == AssigneeTargetType.UNASSIGNED:
            return len(assignees) == 0

        target_id = comparison.get("target_identifier")

        if target_type == AssigneeTargetType.TEAM:
            return any(assignee.team and assignee.team_id == target_id for assignee in assignees)
        elif target_type == AssigneeTargetType.MEMBER:
            return any(assignee.user_id and assignee.user_id == target_id for assignee in assignees)
