from typing import Sequence

from django.db import router, transaction

from sentry.locks import locks
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.types import FallthroughChoiceType
from sentry.utils.locking import UnableToAcquireLock
from sentry.utils.settings import is_self_hosted
from sentry.workflow_engine.defaults.detectors import (
    UnableToAcquireLockApiError,
    _ensure_detector,
    ensure_default_all_projects_detector,
)
from sentry.workflow_engine.handlers.condition.seer_activity_trigger_handler import (
    SeerActivityTriggerStage,
)
from sentry.workflow_engine.models import (
    Action,
    DataCondition,
    DataConditionGroup,
    DataConditionGroupAction,
    Detector,
    DetectorWorkflow,
    Workflow,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.typings.grouptype import IssueStreamGroupType

DEFAULT_WORKFLOW_LABEL = "Send a notification for high priority issues"
PULL_REQUEST_WORKFLOW_LABEL = "Send a notification when pull requests are ready"


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


def connect_workflows_to_detector(
    detector: Detector,
    workflows: list[Workflow],
) -> Sequence[DetectorWorkflow]:
    connections = [DetectorWorkflow(workflow=workflow, detector=detector) for workflow in workflows]
    return DetectorWorkflow.objects.bulk_create(connections, ignore_conflicts=True)


def create_priority_workflow(org: Organization) -> Workflow:
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


def create_and_connect_pull_request_workflow(
    organization: Organization, detector: Detector
) -> Workflow:
    """
    Creates the default PR workflow and connects it to a given detector.
    """
    with transaction.atomic(router.db_for_write(Workflow)):
        when_condition_group = DataConditionGroup.objects.create(
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT, organization=organization
        )
        workflow = Workflow.objects.create(
            organization=organization,
            name=PULL_REQUEST_WORKFLOW_LABEL,
            when_condition_group=when_condition_group,
            config={"frequency": 0},
        )
        DataCondition.objects.create(
            type=Condition.SEER_ACTIVITY_TRIGGER,
            condition_group=when_condition_group,
            # TODO(Leander): Update this with PR_READY_FOR_REVIEW when that's done
            comparison=[SeerActivityTriggerStage.PR_CREATED.value],
            condition_result=True,
        )
        action_filter = DataConditionGroup.objects.create(
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT,
            organization=organization,
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
        DataConditionGroupAction.objects.create(action=action, condition_group=action_filter)
        WorkflowDataConditionGroup.objects.create(workflow=workflow, condition_group=action_filter)
        DetectorWorkflow.objects.create(workflow=workflow, detector=detector)

    return workflow


def ensure_default_workflows(project: Project) -> list[Workflow]:
    workflows = [create_priority_workflow(project.organization)]
    connect_workflows_to_issue_stream(project, workflows)
    return workflows


def ensure_pull_request_workflow(organization: Organization, detector: Detector) -> Workflow:
    """
    A primitive attempt to prevent duplicate workflows by checking if this label/detector combo
    already exists. We don't intend to call `ensure_default_organization_workflows` twice regardless,
    but this will guard if that does happen in quick succession (maybe from an RPC blip somehow).

    Note: If the detector is not connected, a new pull request workflow will be created.
    """
    existing = Workflow.objects.filter(
        organization=organization,
        name=PULL_REQUEST_WORKFLOW_LABEL,
        detectorworkflow__detector=detector,
    ).first()
    if existing:
        return existing

    lock = locks.get(
        f"workflow-engine-org-{IssueStreamGroupType.slug}-detector:pr-workflow:{organization.id}",
        duration=2,
        name="workflow_engine_pull_request_workflow",
    )
    try:
        with (
            lock.blocking_acquire(initial_delay=0.1, timeout=3),
            transaction.atomic(router.db_for_write(Workflow)),
        ):
            existing = Workflow.objects.filter(
                organization=organization,
                name=PULL_REQUEST_WORKFLOW_LABEL,
                detectorworkflow__detector=detector,
            ).first()
            if existing:
                return existing
            return create_and_connect_pull_request_workflow(organization, detector)
    except UnableToAcquireLock:
        raise UnableToAcquireLockApiError


def ensure_default_organization_workflows(organization: Organization) -> list[Workflow]:
    all_projects_detector = ensure_default_all_projects_detector(organization.id)
    workflows: list[Workflow] = []
    if not is_self_hosted():
        workflows.append(ensure_pull_request_workflow(organization, all_projects_detector))
    return workflows
