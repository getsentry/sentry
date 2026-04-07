from typing import Sequence

from django.db import router, transaction

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.types import FallthroughChoiceType
from sentry.workflow_engine.defaults.detectors import _ensure_detector
from sentry.workflow_engine.models import (
    Action,
    DataCondition,
    DataConditionGroup,
    DataConditionGroupAction,
    DetectorWorkflow,
    Workflow,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.typings.grouptype import IssueStreamGroupType

DEFAULT_WORKFLOW_LABEL = "Send a notification for high priority issues"


def connect_workflows_to_issue_stream(
    project: Project,
    workflows: list[Workflow],
) -> Sequence[DetectorWorkflow]:
    # Because we don't know if this signal is handled already or not...
    issue_stream_detector = _ensure_detector(project, IssueStreamGroupType.slug)

    connections = [
        DetectorWorkflow(
            workflow=workflow,
            detector=issue_stream_detector,
        )
        for workflow in workflows
    ]
    return DetectorWorkflow.objects.bulk_create(
        connections,
        ignore_conflicts=True,
    )


def create_priority_workflow(org: Organization) -> Workflow:
    existing = Workflow.objects.filter(organization=org, name=DEFAULT_WORKFLOW_LABEL).first()
    if existing:
        return existing

    with transaction.atomic(router.db_for_write(Workflow)):
        when_condition_group = DataConditionGroup.objects.create(
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT,
            organization=org,
        )

        workflow = Workflow.objects.create(
            organization=org,
            name=DEFAULT_WORKFLOW_LABEL,
            when_condition_group=when_condition_group,
            config={"frequency": 0},
        )

        # Create the workflow trigger conditions
        conditions: list[DataCondition] = []
        conditions.append(
            DataCondition(
                type=Condition.NEW_HIGH_PRIORITY_ISSUE,
                condition_group=workflow.when_condition_group,
                comparison=True,
                condition_result=True,
            )
        )
        conditions.append(
            DataCondition(
                type=Condition.EXISTING_HIGH_PRIORITY_ISSUE,
                condition_group=workflow.when_condition_group,
                comparison=True,
                condition_result=True,
            )
        )
        DataCondition.objects.bulk_create(conditions)

        # Create the Action
        action_filter = DataConditionGroup.objects.create(
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT,
            organization=org,
        )

        action = Action.objects.create(
            type=Action.Type.EMAIL,
            config={
                "target_type": ActionTarget.ISSUE_OWNERS,
                "target_identifier": None,
            },
            data={
                "fallthrough_type": FallthroughChoiceType.ACTIVE_MEMBERS.value,
            },
        )
        DataConditionGroupAction.objects.create(
            action=action,
            condition_group=action_filter,
        )

        WorkflowDataConditionGroup.objects.create(
            workflow=workflow,
            condition_group=action_filter,
        )

    return workflow


def ensure_default_workflows(project: Project) -> list[Workflow]:
    workflows = [create_priority_workflow(project.organization)]
    connect_workflows_to_issue_stream(project, workflows)

    return workflows
