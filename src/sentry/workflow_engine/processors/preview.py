from collections.abc import Sequence
from typing import Any

from sentry.workflow_engine.models.data_condition_group import DataConditionGroup
from sentry.workflow_engine.preview import (
    AlertPreviewPlan,
    InvalidPreviewConfiguration,
    PreviewConditionGroup,
    UnsupportedPreviewBehavior,
)
from sentry.workflow_engine.types import (
    ActionFilterDataConditionHandler,
    WorkflowTriggerDataConditionHandler,
)


def build_alert_preview_plan(
    triggers: PreviewConditionGroup[WorkflowTriggerDataConditionHandler],
    action_filters: Sequence[PreviewConditionGroup[ActionFilterDataConditionHandler[Any]]],
) -> AlertPreviewPlan:
    if triggers.logic_type != DataConditionGroup.Type.ANY_SHORT_CIRCUIT:
        raise InvalidPreviewConfiguration("Workflow triggers must use any-short logic")
    if not triggers.conditions:
        raise InvalidPreviewConfiguration("At least one workflow trigger is required")

    plan = AlertPreviewPlan()
    for trigger_condition in triggers.conditions:
        trigger_behavior = trigger_condition.handler.preview_behavior
        if isinstance(trigger_behavior, UnsupportedPreviewBehavior):
            raise InvalidPreviewConfiguration(
                f"{trigger_condition.type.value} cannot be used in alert previews: "
                f"{trigger_behavior.reason}"
            )
        trigger_behavior.add_to_preview(plan, trigger_condition.comparison)

    for action_filter in action_filters:
        action_filter_plan = plan.add_action_filter(action_filter.logic_type)
        for filter_condition in action_filter.conditions:
            filter_behavior = filter_condition.handler.preview_behavior
            if isinstance(filter_behavior, UnsupportedPreviewBehavior):
                raise InvalidPreviewConfiguration(
                    f"{filter_condition.type.value} cannot be used in alert previews: "
                    f"{filter_behavior.reason}"
                )
            filter_behavior.filter_preview(action_filter_plan, filter_condition.comparison)

    return plan
