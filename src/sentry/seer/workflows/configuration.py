from django.db.models import QuerySet

from sentry.seer.models.workflow import SeerWorkflowConfig
from sentry.workflow_engine.models import (
    Action,
    DataConditionGroupAction,
    WorkflowDataConditionGroup,
)


def investigation_actions(config: SeerWorkflowConfig) -> QuerySet[Action]:
    groups = WorkflowDataConditionGroup.objects.filter(
        workflow_id=config.backing_workflow_id,
        workflow__organization_id=config.organization_id,
    ).values("condition_group_id")
    links = DataConditionGroupAction.objects.filter(condition_group_id__in=groups)
    return Action.objects.filter(
        id__in=links.values("action_id"), type=Action.Type.SEER_INVESTIGATION
    )


def action_is_owned_by_workflow(config: SeerWorkflowConfig, action_id: int) -> bool:
    if not investigation_actions(config).filter(id=action_id).exists():
        return False
    groups = DataConditionGroupAction.objects.filter(action_id=action_id).values(
        "condition_group_id"
    )
    return (
        not WorkflowDataConditionGroup.objects.filter(condition_group_id__in=groups)
        .exclude(workflow_id=config.backing_workflow_id)
        .exists()
    )
