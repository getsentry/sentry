from typing import Any

from sentry.models.group import GroupStatus
from sentry.workflow_engine.handlers.condition.issue_resolved_trigger_condition import (
    IssueResolvedPreviewBehavior,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import WorkflowEventData, WorkflowTriggerDataConditionHandler


@condition_handler_registry.register(Condition.ISSUE_RESOLUTION_CHANGE)
class IssueResolutionConditionHandler(WorkflowTriggerDataConditionHandler):
    preview_behavior = IssueResolvedPreviewBehavior()
    comparison_json_schema = {"type": "integer", "enum": [GroupStatus.RESOLVED]}

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        group = event_data.group
        return group.status == comparison
