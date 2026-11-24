from threading import Barrier
from unittest.mock import patch

import pytest
from django.db import connections
from django.db.models.signals import pre_save

from sentry.constants import ObjectStatus
from sentry.notifications.types import FallthroughChoiceType
from sentry.testutils.cases import TestCase, TransactionTestCase
from sentry.testutils.helpers.options import override_options
from sentry.types.activity import ActivityType
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor
from sentry.workflow_engine.defaults.detectors import (
    ensure_default_all_projects_detector,
    ensure_default_detectors,
)
from sentry.workflow_engine.defaults.workflows import (
    connect_workflows_to_issue_stream,
    create_and_connect_pull_request_workflow,
    create_priority_workflow,
    ensure_default_organization_workflows,
    ensure_default_workflows,
    ensure_inbox_workflow,
    ensure_pull_request_workflow,
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
from sentry.workflow_engine.models.workflow import VISIBLE_WORKFLOW_TYPES
from sentry.workflow_engine.processors.workflow import select_workflows
from sentry.workflow_engine.types import WorkflowEventData
from sentry.workflow_engine.typings.grouptype import IssueStreamGroupType


class TestConnectWorkflowsToIssueStream(TestCase):
    def test_creates_detector_workflow_connections(self) -> None:
        project = self.create_project(create_default_detectors=False)
        workflow1 = self.create_workflow(
            name="Test Workflow 1",
            organization=project.organization,
        )
        workflow2 = self.create_workflow(
            name="Test Workflow 2",
            organization=project.organization,
        )

        connections = connect_workflows_to_issue_stream(project, [workflow1, workflow2])

        assert len(connections) == 2
        assert DetectorWorkflow.objects.filter(workflow=workflow1).exists()
        assert DetectorWorkflow.objects.filter(workflow=workflow2).exists()

        # Verify all workflows are connected to the same issue stream detector
        detector_ids = {c.detector_id for c in connections}
        assert len(detector_ids) == 1
        detector = Detector.objects.get(id=detector_ids.pop())
        assert detector.type == IssueStreamGroupType.slug

    def test_uses_issue_stream_detector(self) -> None:
        project = self.create_project(create_default_detectors=False)
        workflow = self.create_workflow(
            organization=project.organization,
            name="Test Workflow",
        )

        connections = connect_workflows_to_issue_stream(project, [workflow])

        connection = connections[0]
        assert connection.detector.type == IssueStreamGroupType.slug
        assert connection.detector.project_id == project.id

        # Verify only one issue stream detector exists
        issue_stream_detectors = Detector.objects.filter(
            project=project, type=IssueStreamGroupType.slug
        )
        assert issue_stream_detectors.count() == 1

    def test_uses_preexisting_issue_stream_detector(self) -> None:
        """Integration test: verifies that if an issue stream detector already exists, it reuses it."""
        project = self.create_project(create_default_detectors=False)

        # Create the default detectors first (simulating project setup signal)
        default_detectors = ensure_default_detectors(project)
        existing_detector = default_detectors[IssueStreamGroupType.slug]

        # Now connect workflows - should use the existing detector
        workflow = self.create_workflow(
            organization=project.organization,
            name="Test Workflow",
        )

        connections = connect_workflows_to_issue_stream(project, [workflow])

        # Verify it used the pre-existing detector
        assert connections[0].detector_id == existing_detector.id

        # Verify still only one issue stream detector exists
        issue_stream_detectors = Detector.objects.filter(
            project=project, type=IssueStreamGroupType.slug
        )
        assert issue_stream_detectors.count() == 1


class TestCreatePriorityWorkflow(TestCase):
    def test_creates_workflow_with_correct_name(self) -> None:
        org = self.create_organization()
        workflow = create_priority_workflow(org)

        assert workflow.name == "Send a notification for high priority issues"
        assert workflow.organization_id == org.id

    def test_creates_when_condition_group(self) -> None:
        org = self.create_organization()
        workflow = create_priority_workflow(org)

        assert workflow.when_condition_group is not None
        assert workflow.when_condition_group.logic_type == DataConditionGroup.Type.ANY_SHORT_CIRCUIT

    def test_creates_data_conditions(self) -> None:
        org = self.create_organization()
        workflow = create_priority_workflow(org)

        conditions = DataCondition.objects.filter(condition_group=workflow.when_condition_group)
        assert conditions.count() == 2

        condition_types = {c.type for c in conditions}
        assert Condition.NEW_HIGH_PRIORITY_ISSUE in condition_types
        assert Condition.EXISTING_HIGH_PRIORITY_ISSUE in condition_types

        for condition in conditions:
            assert condition.comparison is True
            assert condition.condition_result is True

    def test_creates_email_action(self) -> None:
        org = self.create_organization()

        create_priority_workflow(org)

        action = Action.objects.get(type=Action.Type.EMAIL)
        assert action.config == {
            "target_type": 4,
            "target_identifier": None,
        }
        assert action.data == {
            "fallthrough_type": FallthroughChoiceType.ACTIVE_MEMBERS.value,
        }

    def test_creates_action_filter_and_links(self) -> None:
        org = self.create_organization()

        workflow = create_priority_workflow(org)

        # Verify WorkflowDataConditionGroup exists
        workflow_dcg = WorkflowDataConditionGroup.objects.get(workflow=workflow)
        action_filter = workflow_dcg.condition_group

        # Verify action is linked to the filter
        action = Action.objects.get(type=Action.Type.EMAIL)
        dcg_action = DataConditionGroupAction.objects.get(action=action)
        assert dcg_action.condition_group == action_filter

        # Verify action filter has correct logic type
        assert action_filter.logic_type == DataConditionGroup.Type.ANY_SHORT_CIRCUIT

    def test_creates_separate_workflow_per_call(self) -> None:
        """Each call creates a new Workflow so that each project gets its own."""
        org = self.create_organization()

        workflow1 = create_priority_workflow(org)
        workflow2 = create_priority_workflow(org)

        assert workflow1.id != workflow2.id
        assert (
            Workflow.objects.filter(
                organization=org, name="Send a notification for high priority issues"
            ).count()
            == 2
        )


class TestEnsureDefaultWorkflows(TestCase):
    def test_creates_and_connects_workflows(self) -> None:
        project = self.create_project()

        workflows = ensure_default_workflows(project)

        assert len(workflows) == 1
        workflow = workflows[0]
        assert workflow.name == "Send a notification for high priority issues"

        # Verify connection to issue stream detector
        connection = DetectorWorkflow.objects.get(workflow=workflow)
        assert connection.detector.type == IssueStreamGroupType.slug
        assert connection.detector.project_id == project.id

    def test_returns_workflows_list(self) -> None:
        project = self.create_project()

        workflows = ensure_default_workflows(project)

        assert isinstance(workflows, list)
        assert all(isinstance(w, Workflow) for w in workflows)

    def test_project_created_receiver_connects_issue_stream_detector(self) -> None:
        project = self.create_project(create_default_detectors=False, fire_project_created=True)

        connection = DetectorWorkflow.objects.get(
            workflow__organization=project.organization, detector__project=project
        )
        assert connection.detector.type == IssueStreamGroupType.slug


class TestCreateAndConnectPullRequestWorkflow(TestCase):
    def setUp(self) -> None:
        self.all_projects_detector = ensure_default_all_projects_detector(self.organization.id)

    def test_creates_workflow_with_correct_name(self) -> None:
        workflow = create_and_connect_pull_request_workflow(
            self.organization, self.all_projects_detector
        )

        assert workflow.name == "Send a notification when pull requests are ready"
        assert workflow.organization_id == self.organization.id
        assert workflow.config == {"frequency": 0}

    def test_creates_when_condition_group(self) -> None:
        workflow = create_and_connect_pull_request_workflow(
            self.organization, self.all_projects_detector
        )

        assert workflow.when_condition_group is not None
        assert workflow.when_condition_group.logic_type == DataConditionGroup.Type.ANY_SHORT_CIRCUIT

    def test_creates_data_condition(self) -> None:
        workflow = create_and_connect_pull_request_workflow(
            self.organization, self.all_projects_detector
        )

        conditions = DataCondition.objects.filter(condition_group=workflow.when_condition_group)
        assert conditions.count() == 1

        condition = conditions[0]
        assert condition.type == Condition.SEER_ACTIVITY_TRIGGER
        assert condition.comparison == [SeerActivityTriggerStage.PR_READY_FOR_REVIEW.value]
        assert condition.condition_result is True

    def test_creates_email_action(self) -> None:
        create_and_connect_pull_request_workflow(self.organization, self.all_projects_detector)

        action = Action.objects.get(type=Action.Type.EMAIL)
        assert action.config == {"target_type": 4, "target_identifier": None}
        assert action.data == {"fallthrough_type": FallthroughChoiceType.ACTIVE_MEMBERS.value}

    def test_creates_action_filter_and_links(self) -> None:
        workflow = create_and_connect_pull_request_workflow(
            self.organization, self.all_projects_detector
        )

        workflow_dcg = WorkflowDataConditionGroup.objects.get(workflow=workflow)
        action_filter = workflow_dcg.condition_group

        action = Action.objects.get(type=Action.Type.EMAIL)
        dcg_action = DataConditionGroupAction.objects.get(action=action)
        assert dcg_action.condition_group == action_filter

        assert action_filter.logic_type == DataConditionGroup.Type.ANY_SHORT_CIRCUIT

    def test_connects_workflow_to_detector(self) -> None:
        workflow = create_and_connect_pull_request_workflow(
            self.organization, self.all_projects_detector
        )

        connection = DetectorWorkflow.objects.get(workflow=workflow)
        assert connection.detector == self.all_projects_detector

    def test_creates_separate_workflow_per_call(self) -> None:
        """Each call creates a new Workflow so that each org gets its own."""
        workflow1 = create_and_connect_pull_request_workflow(
            self.organization, self.all_projects_detector
        )
        workflow2 = create_and_connect_pull_request_workflow(
            self.organization, self.all_projects_detector
        )

        assert workflow1.id != workflow2.id
        connections = DetectorWorkflow.objects.filter(detector=self.all_projects_detector)
        assert {c.workflow_id for c in connections} == {workflow1.id, workflow2.id}


class TestEnsurePullRequestWorkflow(TestCase):
    def setUp(self) -> None:
        self.all_projects_detector = ensure_default_all_projects_detector(self.organization.id)

    def test_creates_and_connects_workflow(self) -> None:
        workflow = ensure_pull_request_workflow(self.organization, self.all_projects_detector)
        assert workflow.name == "Send a notification when pull requests are ready"
        assert workflow.organization_id == self.organization.id

        connection = DetectorWorkflow.objects.get(workflow=workflow)
        assert connection.detector == self.all_projects_detector

    def test_reuses_existing_workflow(self) -> None:
        first = ensure_pull_request_workflow(self.organization, self.all_projects_detector)
        second = ensure_pull_request_workflow(self.organization, self.all_projects_detector)

        assert first.id == second.id
        assert (
            Workflow.objects.filter(
                organization=self.organization,
                name="Send a notification when pull requests are ready",
            ).count()
            == 1
        )
        assert (
            DetectorWorkflow.objects.filter(
                workflow=first, detector=self.all_projects_detector
            ).count()
            == 1
        )

    def test_creates_separate_workflows_for_separate_detectors(self) -> None:
        random_detector = self.create_detector(self.project)
        first = ensure_pull_request_workflow(self.organization, self.all_projects_detector)
        second = ensure_pull_request_workflow(self.organization, random_detector)

        assert first.id != second.id

    def test_duplicate_workflows_raises(self) -> None:
        ensure_pull_request_workflow(self.organization, self.all_projects_detector)
        create_and_connect_pull_request_workflow(self.organization, self.all_projects_detector)

        with pytest.raises(Workflow.MultipleObjectsReturned):
            ensure_pull_request_workflow(self.organization, self.all_projects_detector)


class TestEnsureDefaultOrganizationWorkflows(TestCase):
    @override_options({"workflow_engine.auto_creation.pull_request_workflow": True})
    def test_creates_and_connects_workflows(self) -> None:
        workflows = ensure_default_organization_workflows(self.organization)

        assert len(workflows) == 1
        workflow = workflows[0]
        assert workflow.name == "Send a notification when pull requests are ready"
        assert workflow.organization_id == self.organization.id

        connection = DetectorWorkflow.objects.get(workflow=workflow)
        assert connection.detector.type == IssueStreamGroupType.slug
        assert connection.detector.project is None
        assert connection.detector.config["organization_id"] == self.organization.id

    @override_options({"workflow_engine.auto_creation.pull_request_workflow": True})
    def test_uses_existing_all_projects_detector(self) -> None:
        existing_detector = ensure_default_all_projects_detector(self.organization.id)
        workflows = ensure_default_organization_workflows(self.organization)

        assert len(workflows) == 1
        connection = DetectorWorkflow.objects.get(workflow=workflows[0])
        assert connection.detector == existing_detector
        assert (
            Detector.objects.filter(
                type=IssueStreamGroupType.slug,
                project__isnull=True,
                config__organization_id=self.organization.id,
            ).count()
            == 1
        )

    @override_options({"workflow_engine.auto_creation.pull_request_workflow": True})
    def test_returns_workflows_list(self) -> None:
        workflows = ensure_default_organization_workflows(self.organization)
        assert isinstance(workflows, list)
        assert all(isinstance(w, Workflow) for w in workflows)

    def test_skips_pull_request_workflow_when_option_disabled(self) -> None:
        workflows = ensure_default_organization_workflows(self.organization)
        assert workflows == []


class TestEnsureInboxWorkflow(TestCase):
    def test_graph(self) -> None:
        org = self.create_organization()
        workflow = ensure_inbox_workflow(org)

        assert workflow.type == Workflow.Type.INBOX
        assert workflow.type not in VISIBLE_WORKFLOW_TYPES
        assert workflow.organization == org
        assert workflow.enabled
        assert workflow.environment_id is None
        assert workflow.config == {"frequency": 0}
        assert not DetectorWorkflow.objects.filter(workflow=workflow).exists()

        trigger = workflow.when_condition_group
        assert trigger is not None
        assert trigger.organization == org
        condition = trigger.conditions.get()
        assert condition.type == Condition.ACTIVITY_TYPE_IN
        assert condition.comparison == ["issue.assigned", "issue.mentioned"]
        assert condition.condition_result is True

        action_group = WorkflowDataConditionGroup.objects.get(workflow=workflow).condition_group
        assert action_group.organization == org
        assert not action_group.conditions.exists()
        action = DataConditionGroupAction.objects.get(condition_group=action_group).action
        assert action.type == Action.Type.ADD_TO_INBOX
        assert action.config == {}
        assert action.data == {}

    def test_reuses_only_the_managed_default(self) -> None:
        org = self.organization
        priority = create_priority_workflow(org)
        pr_ready = create_and_connect_pull_request_workflow(
            org, ensure_default_all_projects_detector(org.id)
        )
        first = ensure_inbox_workflow(org)
        other = self.create_workflow(organization=org, type=Workflow.Type.INBOX, name=first.name)
        first.update(name="Renamed", enabled=False)
        second = ensure_inbox_workflow(org)
        assert second == first
        assert second.name == "Renamed"
        assert not second.enabled
        assert second.when_condition_group_id == first.when_condition_group_id
        assert set(Workflow.objects.filter(organization=org)) == {first, priority, pr_ready, other}
        assert ensure_inbox_workflow(self.create_organization()) != first

    def test_pending_deletion_reserves_the_key(self) -> None:
        workflow = ensure_inbox_workflow(self.organization)
        workflow.update(status=ObjectStatus.PENDING_DELETION)
        with pytest.raises(Workflow.DoesNotExist, match="being deleted"):
            ensure_inbox_workflow(self.organization)
        assert Workflow.objects_for_deletion.get(organization=self.organization) == workflow

    def test_selection_after_commit(self) -> None:
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.ASSIGNED.value,
            data={"assigneeType": "user", "assignee": str(self.user.id)},
        )
        event_data = WorkflowEventData(event=activity, group=self.group)
        with self.feature("organizations:workflow-engine-activity-workflows"):
            assert select_workflows(event_data, [], None) == set()
            with self.captureOnCommitCallbacks(execute=True):
                workflow = ensure_inbox_workflow(self.organization)
            assert select_workflows(event_data, [], None) == {workflow}
        assert select_workflows(event_data, [], None) == set()
        evaluation, _ = workflow.evaluate_trigger_conditions(event_data)
        assert evaluation.triggered

    def test_only_notes_with_mentions_match(self) -> None:
        workflow = ensure_inbox_workflow(self.organization)
        note = self.create_group_activity(group=self.group, type=ActivityType.NOTE.value)
        event_data = WorkflowEventData(event=note, group=self.group)
        evaluation, _ = workflow.evaluate_trigger_conditions(event_data)
        assert not evaluation.triggered
        note.data = {"mentions": [{"actor_type": "user", "id": self.user.id}]}
        evaluation, _ = workflow.evaluate_trigger_conditions(event_data)
        assert evaluation.triggered

    def test_rollback_and_retry(self) -> None:
        org = self.create_organization()
        with (
            patch.object(
                WorkflowDataConditionGroup.objects,
                "create",
                side_effect=RuntimeError("link failed"),
            ),
            pytest.raises(RuntimeError, match="link failed"),
        ):
            ensure_inbox_workflow(org)
        assert not Workflow.objects.filter(organization=org).exists()
        assert not DataConditionGroup.objects.filter(organization=org).exists()
        assert not DataCondition.objects.filter(type=Condition.ACTIVITY_TYPE_IN).exists()
        assert not Action.objects.filter(type=Action.Type.ADD_TO_INBOX).exists()

        workflow = ensure_inbox_workflow(org)
        action_group = WorkflowDataConditionGroup.objects.get(workflow=workflow).condition_group
        assert (
            DataConditionGroupAction.objects.get(condition_group=action_group).action.type
            == Action.Type.ADD_TO_INBOX
        )


class TestConcurrentInboxWorkflow(TransactionTestCase):
    def test_concurrent_first_calls(self) -> None:
        org = self.create_organization()
        ready = Barrier(2, timeout=20)

        def wait_before_insert(**kwargs: object) -> None:
            ready.wait()

        def provision() -> Workflow:
            try:
                return ensure_inbox_workflow(org)
            finally:
                connections.close_all()

        # Both callers have missed the initial lookup and allocated a trigger group.
        pre_save.connect(wait_before_insert, sender=Workflow)
        try:
            with ContextPropagatingThreadPoolExecutor(max_workers=2) as executor:
                results = [executor.submit(provision) for _ in range(2)]
                first, second = [result.result(timeout=30) for result in results]
        finally:
            pre_save.disconnect(wait_before_insert, sender=Workflow)

        assert first == second == Workflow.objects.get(organization=org)
        assert DataConditionGroup.objects.filter(organization=org).count() == 2
        assert (
            DataCondition.objects.get(condition_group__organization=org).condition_group_id
            == first.when_condition_group_id
        )
        action_group = WorkflowDataConditionGroup.objects.get(workflow=first).condition_group
        assert DataConditionGroupAction.objects.get(
            condition_group=action_group
        ).action == Action.objects.get(type=Action.Type.ADD_TO_INBOX)
