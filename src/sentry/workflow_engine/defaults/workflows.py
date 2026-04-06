from typing import Sequence

from django.db import router, transaction

from sentry.models.organization import Organization
from sentry.models.project import Project
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
    return DetectorWorkflow.objects.bulk_create(connections)


def create_priority_workflow(org: Organization) -> Workflow:
    with transaction.atomic(router.db_for_write(Workflow)):
        workflow, is_created = Workflow.objects.get_or_create(
            organization=org,
            name=DEFAULT_WORKFLOW_LABEL,
            config={"frequency": 0},
        )

        if not is_created:
            # if it exists, assume it was created correctly
            return workflow

        # Create the workflow trigger conditions
        workflow.when_condition_group = DataConditionGroup.objects.create(
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT,
        )

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
        )

        action = Action.objects.create(
            type=Action.Type.EMAIL,
            config={
                "target_type": "IssueOwners",
                "target_identifier": None,
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
    workflows: list[Workflow] = []

    workflows.append(create_priority_workflow(project.organization))

    connect_workflows_to_issue_stream(project, workflows)
    return workflows
