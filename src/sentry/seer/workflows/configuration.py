from django.db.models import QuerySet

from sentry.constants import ObjectStatus
from sentry.incidents.grouptype import MetricIssue
from sentry.seer.models.workflow import (
    SEER_CONFIGURABLE_WORKFLOW_STRATEGIES,
    SeerWorkflowConfig,
    SeerWorkflowConfigExtras,
    SeerWorkflowStrategy,
)
from sentry.seer.workflows.action_settings import InvestigationSettings
from sentry.workflow_engine.models import (
    Action,
    DataCondition,
    DataConditionGroup,
    DataConditionGroupAction,
    Workflow,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.models.data_condition import Condition


def default_action_settings(strategy: str) -> InvestigationSettings:
    if strategy == SeerWorkflowStrategy.AGENTIC_TRIAGE_V2:
        return InvestigationSettings(mode="prompted", prompt="Triage yesterday's new issues")
    return InvestigationSettings()


def create_backing_workflow(
    config: SeerWorkflowConfig, *, extras: SeerWorkflowConfigExtras, enabled: bool
) -> Workflow:
    settings = (
        InvestigationSettings.parse_obj(extras.action_settings)
        if extras.action_settings is not None
        else default_action_settings(config.strategy)
    )
    is_metric = config.strategy == SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION
    when = None
    if is_metric:
        when = DataConditionGroup.objects.create(
            organization_id=config.organization_id,
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT,
        )
        DataCondition.objects.create(
            condition_group=when,
            type=Condition.FIRST_SEEN_EVENT,
            comparison=True,
            condition_result=True,
        )
    workflow = Workflow.objects.create(
        organization_id=config.organization_id,
        name=extras.name or "Seer automation",
        enabled=enabled,
        created_by_id=extras.created_by,
        config={"frequency": 0},
        when_condition_group=when,
    )
    group = DataConditionGroup.objects.create(
        organization_id=config.organization_id, logic_type=DataConditionGroup.Type.ALL
    )
    if is_metric:
        DataCondition.objects.create(
            condition_group=group,
            type=Condition.ISSUE_TYPE,
            comparison={"value": MetricIssue.slug},
            condition_result=True,
        )
    action = Action.objects.create(
        type=Action.Type.SEER_INVESTIGATION, config={}, data=settings.dict()
    )
    WorkflowDataConditionGroup.objects.create(workflow=workflow, condition_group=group)
    DataConditionGroupAction.objects.create(condition_group=group, action=action)
    return workflow


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


def is_enabled(config: SeerWorkflowConfig) -> bool:
    if config.strategy not in SEER_CONFIGURABLE_WORKFLOW_STRATEGIES:
        return config.enabled
    return (
        config.backing_workflow is not None
        and config.backing_workflow.enabled
        and config.backing_workflow.status == ObjectStatus.ACTIVE
    )


def read_extras(config: SeerWorkflowConfig) -> SeerWorkflowConfigExtras:
    extras = SeerWorkflowConfigExtras.parse_obj(config.extras)
    workflow = config.backing_workflow
    if workflow is not None:
        extras.name = workflow.name
        extras.created_by = workflow.created_by_id
        action = investigation_actions(config).get()
        extras.action_settings = InvestigationSettings.parse_obj(action.data).dict()
    return extras
