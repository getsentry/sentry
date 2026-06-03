from __future__ import annotations

import copy
from typing import TYPE_CHECKING, Any

from sentry.db.models import DefaultFieldsModel
from sentry.workflow_engine.models import (
    DataCondition,
    DataConditionGroup,
    DataConditionGroupAction,
    WorkflowDataConditionGroup,
)

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.workflow_engine.models import Workflow


def _simple_shallow_clone[T: DefaultFieldsModel](original: T, **overrides: Any) -> T:
    new = copy.copy(original)
    new.pk = None
    new.id = None
    for attr, value in overrides.items():
        setattr(new, attr, value)
    new.save()
    return new


def clone_workflow_to_organization(
    workflow: Workflow,
    destination_organization: Organization,
    environment_id: int | None,
) -> Workflow:
    """Deep-copy a workflow and its condition graph into the destination organization.

    Used by ``Project.transfer_to`` when a workflow is shared with detectors in other
    projects: the transferring project gets its own copy in the new org while the original
    is left intact for the projects that remain. The owner team/user is dropped because it
    won't belong to the new org, and fire history / detector state are not copied.
    """

    def clone_condition_group(
        condition_group: DataConditionGroup,
    ) -> DataConditionGroup:
        new_group = DataConditionGroup.objects.create(
            organization_id=destination_organization.id,
            logic_type=condition_group.logic_type,
        )
        for condition in DataCondition.objects.filter(condition_group=condition_group):
            data_condition_overrides = {
                "condition_group": new_group,
                "type": condition.type,
                "comparison": condition.comparison,
                "condition_result": condition.condition_result,
            }
            _simple_shallow_clone(condition, **data_condition_overrides)

        # Actions are not organization-scoped; clone them so the copy is fully isolated
        # from the original workflow that stays behind in the old org.
        for group_action in DataConditionGroupAction.objects.filter(
            condition_group=condition_group
        ).select_related("action"):
            action = group_action.action
            action_overrides = {
                "type": action.type,
                "data": action.data,
                "integration_id": action.integration_id,
                "status": action.status,
                "config": action.config,
            }
            new_action = _simple_shallow_clone(action, **action_overrides)
            _simple_shallow_clone(
                group_action, **{"condition_group": new_group, "action": new_action}
            )
        return new_group

    when_condition_group = workflow.when_condition_group
    workflow_overrides = {
        "organization_id": destination_organization.id,
        "name": workflow.name,
        "enabled": workflow.enabled,
        "config": workflow.config,
        # The owner team/user belongs to the old org, so it won't be valid in the
        # destination org; drop it rather than carry a dangling reference.
        "owner_user_id": None,
        "owner_team_id": None,
        "when_condition_group": clone_condition_group(when_condition_group)
        if when_condition_group is not None
        else None,
        "environment_id": environment_id,
    }
    new_workflow = _simple_shallow_clone(workflow, **workflow_overrides)

    for workflow_dcg in WorkflowDataConditionGroup.objects.filter(workflow=workflow):
        _simple_shallow_clone(
            workflow_dcg,
            **{
                "workflow": new_workflow,
                "condition_group": clone_condition_group(workflow_dcg.condition_group),
            },
        )

    return new_workflow
