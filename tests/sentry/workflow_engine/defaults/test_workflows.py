from sentry.notifications.types import FallthroughChoiceType
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
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
        assert condition.comparison == [SeerActivityTriggerStage.PR_CREATED.value]
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
