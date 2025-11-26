from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.utils import timezone

from sentry.integrations.base import IntegrationFeatures
from sentry.testutils.helpers.datetime import freeze_time
from sentry.workflow_engine.models import (
    Action,
    DataConditionGroup,
    Workflow,
    WorkflowActionGroupStatus,
)
from sentry.workflow_engine.processors.action import (
    filter_recently_fired_workflow_actions,
    get_workflow_action_group_statuses,
    is_action_permitted,
    process_workflow_action_group_statuses,
    update_workflow_action_group_statuses,
)
from sentry.workflow_engine.types import WorkflowEventData
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


@freeze_time("2024-01-09")
class TestFilterRecentlyFiredWorkflowActions(BaseWorkflowTest):
    def setUp(self) -> None:
        (
            self.workflow,
            self.detector,
            self.detector_workflow,
            self.workflow_triggers,
        ) = self.create_detector_and_workflow()

        self.action_group, self.action = self.create_workflow_action(workflow=self.workflow)

        self.group, self.event, self.group_event = self.create_group_event(
            occurrence=self.build_occurrence(evidence_data={"detector_id": self.detector.id})
        )
        self.event_data = WorkflowEventData(event=self.group_event, group=self.group)

    def test(self) -> None:
        status_1 = WorkflowActionGroupStatus.objects.create(
            workflow=self.workflow, action=self.action, group=self.group
        )
        status_1.update(date_updated=timezone.now() - timedelta(days=1))

        _, action = self.create_workflow_action(workflow=self.workflow)
        status_2 = WorkflowActionGroupStatus.objects.create(
            workflow=self.workflow, action=action, group=self.group
        )

        triggered_actions = filter_recently_fired_workflow_actions(
            set(DataConditionGroup.objects.all()), self.event_data
        )
        assert set(triggered_actions) == {self.action}
        assert {getattr(action, "workflow_id") for action in triggered_actions} == {
            self.workflow.id,
        }

        for status in [status_1, status_2]:
            status.refresh_from_db()
            assert status.date_updated == timezone.now()

    def test_multiple_workflows(self) -> None:
        status_1 = WorkflowActionGroupStatus.objects.create(
            workflow=self.workflow, action=self.action, group=self.group
        )
        status_1.update(date_updated=timezone.now() - timedelta(hours=1))

        workflow = self.create_workflow(organization=self.organization, config={"frequency": 1440})
        self.create_detector_workflow(detector=self.detector, workflow=workflow)
        _, action_2 = self.create_workflow_action(workflow=workflow)
        status_2 = WorkflowActionGroupStatus.objects.create(
            workflow=workflow, action=action_2, group=self.group
        )

        action_3 = self.create_action(type=Action.Type.PLUGIN)
        self.create_workflow_action(workflow=workflow, action=action_3)

        status_3 = WorkflowActionGroupStatus.objects.create(
            workflow=workflow, action=action_3, group=self.group
        )
        status_3.update(date_updated=timezone.now() - timedelta(days=2))

        triggered_actions = filter_recently_fired_workflow_actions(
            set(DataConditionGroup.objects.all()), self.event_data
        )
        assert set(triggered_actions) == {self.action, action_3}

        for status in [status_1, status_2, status_3]:
            status.refresh_from_db()
            assert status.date_updated == timezone.now()

    def test_multiple_workflows_single_action__first_fire(self) -> None:
        workflow = self.create_workflow(organization=self.organization, config={"frequency": 1440})
        action_group = self.create_data_condition_group(logic_type="any-short")
        self.create_data_condition_group_action(
            condition_group=action_group,
            action=self.action,
        )  # shared action
        self.create_workflow_data_condition_group(workflow, action_group)

        triggered_actions = filter_recently_fired_workflow_actions(
            set(DataConditionGroup.objects.all()), self.event_data
        )
        # dedupes action if both workflows will fire it
        assert set(triggered_actions) == {self.action}
        # Dedupes action so we have a single workflow_id -> environment to fire with
        assert getattr(triggered_actions[0], "workflow_id") == self.workflow.id

        assert WorkflowActionGroupStatus.objects.filter(action=self.action).count() == 2

    def test_multiple_workflows_single_action__later_fire(self) -> None:
        workflow = self.create_workflow(organization=self.organization, config={"frequency": 1440})
        action_group = self.create_data_condition_group(logic_type="any-short")
        self.create_data_condition_group_action(
            condition_group=action_group,
            action=self.action,
        )  # shared action
        self.create_workflow_data_condition_group(workflow, action_group)

        status = WorkflowActionGroupStatus.objects.create(
            workflow=workflow, action=self.action, group=self.group
        )
        status.update(date_updated=timezone.now() - timedelta(hours=1))

        triggered_actions = filter_recently_fired_workflow_actions(
            set(DataConditionGroup.objects.all()), self.event_data
        )
        # fires one action for the workflow that can fire it
        assert set(triggered_actions) == {self.action}
        assert {getattr(action, "workflow_id") for action in triggered_actions} == {
            self.workflow.id
        }

        assert WorkflowActionGroupStatus.objects.filter(action=self.action).count() == 2

        assert (
            WorkflowActionGroupStatus.objects.get(
                workflow=self.workflow, action=self.action, group=self.group
            ).date_updated
            == timezone.now()
        )

        status.refresh_from_db()
        assert status.date_updated == timezone.now() - timedelta(hours=1)

    def test_get_workflow_action_group_statuses(self) -> None:
        workflow = self.create_workflow(organization=self.organization)
        WorkflowActionGroupStatus.objects.create(
            workflow=workflow, action=self.action, group=self.group
        )
        status = WorkflowActionGroupStatus.objects.create(
            workflow=self.workflow, action=self.action, group=self.group
        )
        workflow_ids = {self.workflow.id, workflow.id}

        action_to_statuses = get_workflow_action_group_statuses(
            {self.action.id: {self.workflow.id}}, self.group, workflow_ids
        )
        assert action_to_statuses == {self.action.id: [status]}

    def test_process_workflow_action_group_statuses(self) -> None:
        workflow = self.create_workflow(organization=self.organization, config={"frequency": 1440})
        action_group = self.create_data_condition_group(logic_type="any-short")
        self.create_data_condition_group_action(
            condition_group=action_group,
            action=self.action,
        )  # shared action
        self.create_workflow_data_condition_group(workflow, action_group)
        status = WorkflowActionGroupStatus.objects.create(
            workflow=workflow, action=self.action, group=self.group
        )
        status.update(date_updated=timezone.now() - timedelta(hours=1))

        _, action = self.create_workflow_action(workflow=workflow)
        status_2 = WorkflowActionGroupStatus.objects.create(
            workflow=workflow, action=action, group=self.group
        )
        status_2.update(date_updated=timezone.now() - timedelta(days=1, minutes=1))

        workflows = Workflow.objects.all()
        action_to_statuses = {self.action.id: [status], action.id: [status_2]}
        action_to_workflows_ids = {self.action.id: {self.workflow.id}, action.id: {workflow.id}}

        action_to_workflow_ids, statuses_to_update, missing_statuses = (
            process_workflow_action_group_statuses(
                action_to_workflows_ids, action_to_statuses, workflows, self.group, timezone.now()
            )
        )

        assert action_to_workflow_ids == {
            self.action.id: {self.workflow.id},
            action.id: {workflow.id},
        }
        assert statuses_to_update == {status_2.id}

        assert len(missing_statuses) == 1

        missing_status = missing_statuses[0]
        assert missing_status.workflow == self.workflow
        assert missing_status.action == self.action
        assert missing_status.group == self.group

    def test_update_workflow_action_group_statuses(self) -> None:
        status = WorkflowActionGroupStatus.objects.create(
            workflow=self.workflow, action=self.action, group=self.group
        )
        status.update(date_updated=timezone.now() - timedelta(hours=1))

        _, action = self.create_workflow_action(workflow=self.workflow)
        statuses_to_create = [
            WorkflowActionGroupStatus(
                workflow=self.workflow, action=action, group=self.group, date_updated=timezone.now()
            )
        ]
        update_workflow_action_group_statuses(timezone.now(), {status.id}, statuses_to_create)

        all_statuses = WorkflowActionGroupStatus.objects.all()
        assert all_statuses.count() == 2
        for status in all_statuses:
            assert status.date_updated == timezone.now()

    def test_returns_uncreated_statuses(self) -> None:
        WorkflowActionGroupStatus.objects.create(
            workflow=self.workflow, action=self.action, group=self.group
        )

        statuses_to_create = [
            WorkflowActionGroupStatus(
                workflow=self.workflow,
                action=self.action,
                group=self.group,
                date_updated=timezone.now(),
            )
        ]
        _, _, uncreated_statuses = update_workflow_action_group_statuses(
            timezone.now(), set(), statuses_to_create
        )

        assert uncreated_statuses == [(self.workflow.id, self.action.id)]

    @patch("sentry.workflow_engine.processors.action.update_workflow_action_group_statuses")
    def test_does_not_fire_for_uncreated_statuses(self, mock_update: MagicMock) -> None:
        mock_update.return_value = (0, 0, [(self.workflow.id, self.action.id)])

        triggered_actions = filter_recently_fired_workflow_actions(
            set(DataConditionGroup.objects.all()), self.event_data
        )

        assert set(triggered_actions) == set()

    @patch("sentry.workflow_engine.processors.action.update_workflow_action_group_statuses")
    def test_fires_for_non_conflicting_workflow(self, mock_update: MagicMock) -> None:
        workflow = self.create_workflow(organization=self.organization, config={"frequency": 1440})
        action_group = self.create_data_condition_group(logic_type="any-short")
        self.create_data_condition_group_action(
            condition_group=action_group,
            action=self.action,
        )  # shared action
        self.create_workflow_data_condition_group(workflow, action_group)

        mock_update.return_value = (0, 0, [(self.workflow.id, self.action.id)])

        triggered_actions = filter_recently_fired_workflow_actions(
            set(DataConditionGroup.objects.all()), self.event_data
        )

        assert set(triggered_actions) == {self.action}
        assert getattr(triggered_actions[0], "workflow_id") == workflow.id


class TestIsActionPermitted(BaseWorkflowTest):
    @patch("sentry.workflow_engine.processors.action._get_integration_features")
    def test_basic(self, mock_get_features: MagicMock) -> None:
        org = self.create_organization()

        # Test non-integration actions (should always be permitted)
        assert is_action_permitted(Action.Type.EMAIL, org)
        assert is_action_permitted(Action.Type.SENTRY_APP, org)

        # Single rule.
        mock_get_features.return_value = {IntegrationFeatures.ALERT_RULE}
        with self.feature({"organizations:integrations-alert-rule": False}):
            assert not is_action_permitted(Action.Type.SLACK, org)

        with self.feature("organizations:integrations-alert-rule"):
            assert is_action_permitted(Action.Type.SLACK, org)

        # Multiple required features.
        mock_get_features.return_value = {
            IntegrationFeatures.ALERT_RULE,
            IntegrationFeatures.ISSUE_BASIC,
        }
        with self.feature(
            {
                "organizations:integrations-alert-rule": True,
                "organizations:integrations-issue-basic": False,
            }
        ):
            assert not is_action_permitted(Action.Type.JIRA, org)

        # Both need to be enabled for permission.
        with self.feature(
            {
                "organizations:integrations-alert-rule": True,
                "organizations:integrations-issue-basic": True,
            }
        ):
            assert is_action_permitted(Action.Type.JIRA, org)
