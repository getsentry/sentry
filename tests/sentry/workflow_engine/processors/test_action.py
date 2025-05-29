from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone

from sentry.integrations.base import IntegrationFeatures
from sentry.testutils.helpers.datetime import freeze_time
from sentry.workflow_engine.models import (
    Action,
    DataConditionGroup,
    WorkflowActionGroupStatus,
    WorkflowFireHistory,
)
from sentry.workflow_engine.models.action_group_status import ActionGroupStatus
from sentry.workflow_engine.processors.action import (
    create_workflow_fire_histories,
    filter_recently_fired_actions,
    filter_recently_fired_workflow_actions,
    is_action_permitted,
)
from sentry.workflow_engine.types import WorkflowEventData
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


@freeze_time("2024-01-09")
class TestFilterRecentlyFiredActions(BaseWorkflowTest):
    def setUp(self):
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
        self.event_data = WorkflowEventData(event=self.group_event)

    def test(self):
        # test default frequency when no workflow.config set
        status_1 = ActionGroupStatus.objects.create(action=self.action, group=self.group)
        status_1.update(date_updated=timezone.now() - timedelta(days=1))

        _, action = self.create_workflow_action(workflow=self.workflow)
        status_2 = ActionGroupStatus.objects.create(action=action, group=self.group)

        triggered_actions = filter_recently_fired_actions(
            set(DataConditionGroup.objects.all()), self.event_data
        )
        assert set(triggered_actions) == {self.action}

        for status in [status_1, status_2]:
            status.refresh_from_db()
            assert status.date_updated == timezone.now()

    def test_multiple_workflows(self):
        status_1 = ActionGroupStatus.objects.create(action=self.action, group=self.group)
        status_1.update(date_updated=timezone.now() - timedelta(hours=1))

        workflow = self.create_workflow(organization=self.organization, config={"frequency": 1440})
        self.create_detector_workflow(detector=self.detector, workflow=workflow)
        _, action_2 = self.create_workflow_action(workflow=workflow)
        status_2 = ActionGroupStatus.objects.create(action=action_2, group=self.group)

        _, action_3 = self.create_workflow_action(workflow=workflow)
        status_3 = ActionGroupStatus.objects.create(action=action_3, group=self.group)
        status_3.update(date_updated=timezone.now() - timedelta(days=2))

        triggered_actions = filter_recently_fired_actions(
            set(DataConditionGroup.objects.all()), self.event_data
        )
        assert set(triggered_actions) == {self.action, action_3}

        for status in [status_1, status_2, status_3]:
            status.refresh_from_db()
            assert status.date_updated == timezone.now()


@freeze_time("2024-01-09")
class TestFilterRecentlyFiredWorkflowActions(BaseWorkflowTest):
    def setUp(self):
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
        self.event_data = WorkflowEventData(event=self.group_event)

    def test(self):
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

        for status in [status_1, status_2]:
            status.refresh_from_db()
            assert status.date_updated == timezone.now()

    def test_multiple_workflows(self):
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

        _, action_3 = self.create_workflow_action(workflow=workflow)
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

    def test_multiple_workflows_single_action__first_fire(self):
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

        assert WorkflowActionGroupStatus.objects.filter(action=self.action).count() == 2

    def test_multiple_workflows_single_action__later_fire(self):
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

        assert WorkflowActionGroupStatus.objects.filter(action=self.action).count() == 2

        assert (
            WorkflowActionGroupStatus.objects.get(
                workflow=self.workflow, action=self.action, group=self.group
            ).date_updated
            == timezone.now()
        )

        status.refresh_from_db()
        assert status.date_updated == timezone.now() - timedelta(hours=1)


class TestWorkflowFireHistory(BaseWorkflowTest):
    def setUp(self):
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
        self.event_data = WorkflowEventData(event=self.group_event)

    def test_create_workflow_fire_histories(self):
        create_workflow_fire_histories(Action.objects.filter(id=self.action.id), self.event_data)
        assert (
            WorkflowFireHistory.objects.filter(
                workflow=self.workflow,
                group=self.group,
                event_id=self.group_event.event_id,
            ).count()
            == 1
        )


class TestIsActionPermitted(BaseWorkflowTest):
    @patch("sentry.workflow_engine.processors.action._get_integration_features")
    def test_basic(self, mock_get_features):
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
