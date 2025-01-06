from collections.abc import Sequence
from typing import Any

from sentry.models.group import Group
from sentry.models.team import Team
from sentry.notifications.types import AssigneeTargetType
from sentry.users.models.user import User
from sentry.utils.cache import cache
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler, WorkflowJob


@condition_handler_registry.register(Condition.ASSIGNED_TO)
class AssignedToConditionHandler(DataConditionHandler[WorkflowJob]):
    @staticmethod
    def get_assignees(group: Group) -> Sequence[Team | User]:
        cache_key = f"group:{group.id}:assignees"
        assignee_list: Sequence[Team | User] | None = cache.get(cache_key)
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
            for assignee in assignees:
                if assignee.team and assignee.team_id == target_id:
                    return True
        elif target_type == AssigneeTargetType.MEMBER:
            for assignee in assignees:
                if assignee.user_id and assignee.user_id == target_id:
                    return True
        return False
