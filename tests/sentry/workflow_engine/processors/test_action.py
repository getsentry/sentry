from datetime import timedelta
from unittest.mock import MagicMock, patch
from uuid import uuid4

from django.db import connection
from django.utils import timezone

from sentry.integrations.base import IntegrationFeatures
from sentry.models.activity import Activity
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.testutils.helpers.datetime import freeze_time
from sentry.types.activity import ActivityType
from sentry.workflow_engine.buffer.batch_client import DelayedWorkflowClient
from sentry.workflow_engine.models import (
    Action,
    DataConditionGroup,
    Workflow,
    WorkflowActionGroupStatus,
    WorkflowFireHistory,
)
from sentry.workflow_engine.processors.action import (
    StatusUpdateResult,
    filter_recently_fired_workflow_actions,
    fire_actions,
    get_workflow_action_group_statuses,
    is_action_permitted,
    process_workflow_action_group_statuses,
    update_workflow_action_group_statuses,
)
from sentry.workflow_engine.processors.workflow import process_workflows
from sentry.workflow_engine.processors.workflow_fire_history import create_workflow_fire_histories
from sentry.workflow_engine.types import ActionHandler, FeatureGate, WorkflowEventData
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest, OrganizationEvent


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

        triggered_actions, action_to_workflow_id, _ = filter_recently_fired_workflow_actions(
            set(DataConditionGroup.objects.all()), self.event_data
        )
        assert set(triggered_actions) == {self.action}
        assert set(action_to_workflow_id.values()) == {self.workflow.id}

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

        triggered_actions, action_to_workflow_id, _ = filter_recently_fired_workflow_actions(
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

        triggered_actions, action_to_workflow_id, _ = filter_recently_fired_workflow_actions(
            set(DataConditionGroup.objects.all()), self.event_data
        )
        # dedupes action if both workflows will fire it
        assert set(triggered_actions) == {self.action}
        # Dedupes action so we have a single workflow_id to fire with
        assert action_to_workflow_id[self.action.id] == self.workflow.id

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

        triggered_actions, action_to_workflow_id, _ = filter_recently_fired_workflow_actions(
            set(DataConditionGroup.objects.all()), self.event_data
        )
        # fires one action for the workflow that can fire it
        assert set(triggered_actions) == {self.action}
        assert set(action_to_workflow_id.values()) == {self.workflow.id}

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
        result = update_workflow_action_group_statuses(timezone.now(), set(), statuses_to_create)

        assert result.not_created == [(self.workflow.id, self.action.id)]

    def test_update_workflow_action_group_statuses_missing_group(self) -> None:
        new_group = self.create_group()
        new_group2 = self.create_group()
        _, new_action = self.create_workflow_action(workflow=self.workflow)

        to_create = [
            WorkflowActionGroupStatus(
                workflow=self.workflow,
                action=self.action,
                group_id=new_group.id,
                date_updated=timezone.now(),
            ),
            WorkflowActionGroupStatus(
                workflow=self.workflow,
                action=new_action,
                group_id=new_group2.id,
                date_updated=timezone.now(),
            ),
        ]

        new_group.delete()

        # The FK constraint on group_id is DEFERRABLE INITIALLY DEFERRED,
        # so within the test transaction the delete above doesn't enforce the
        # FK check. Set constraints to immediate so the INSERT behaves like
        # production (separate transactions).
        with connection.cursor() as cursor:
            cursor.execute("SET CONSTRAINTS ALL IMMEDIATE")

        result = update_workflow_action_group_statuses(timezone.now(), set(), to_create)
        assert result.created == 1
        assert result.not_created == [(self.workflow.id, self.action.id)]

    @patch("sentry.workflow_engine.processors.action.update_workflow_action_group_statuses")
    def test_does_not_fire_for_uncreated_statuses(self, mock_update: MagicMock) -> None:
        mock_update.return_value = StatusUpdateResult(
            updated=0, created=0, not_created=[(self.workflow.id, self.action.id)]
        )

        triggered_actions, action_to_workflow_id, _ = filter_recently_fired_workflow_actions(
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

        mock_update.return_value = StatusUpdateResult(
            updated=0, created=0, not_created=[(self.workflow.id, self.action.id)]
        )

        triggered_actions, action_to_workflow_id, _ = filter_recently_fired_workflow_actions(
            set(DataConditionGroup.objects.all()), self.event_data
        )

        assert set(triggered_actions) == {self.action}
        assert action_to_workflow_id[self.action.id] == workflow.id

    def test_skips_action_with_no_workflow(self) -> None:
        orphan_group = self.create_data_condition_group(logic_type="any-short")
        orphan_action = self.create_action(type=Action.Type.PLUGIN)
        self.create_data_condition_group_action(
            condition_group=orphan_group,
            action=orphan_action,
        )
        # No WorkflowDataConditionGroup links orphan_group to any workflow

        triggered_actions, action_to_workflow_id, _ = filter_recently_fired_workflow_actions(
            {self.action_group, orphan_group}, self.event_data
        )

        # The orphan action should not appear; the normal action still fires
        assert set(triggered_actions) == {self.action}


class TestIsActionPermitted(BaseWorkflowTest):
    def test_non_integration_action_requires_handler_features(self) -> None:
        class GatedActionHandler(ActionHandler):
            required_features = (FeatureGate("organizations:seer-automations"),)

        with patch(
            "sentry.workflow_engine.processors.action.action_handler_registry.get",
            return_value=GatedActionHandler,
        ):
            with self.feature({"organizations:seer-automations": False}):
                assert not is_action_permitted(Action.Type.SEER_WORKFLOW, self.organization)

            with self.feature("organizations:seer-automations"):
                assert is_action_permitted(Action.Type.SEER_WORKFLOW, self.organization)

    def test_integration_requires_handler_and_provider_features(self) -> None:
        class GatedActionHandler(ActionHandler):
            required_features = (FeatureGate("organizations:seer-automations"),)

        with (
            patch(
                "sentry.workflow_engine.processors.action.action_handler_registry.get",
                return_value=GatedActionHandler,
            ),
            patch(
                "sentry.workflow_engine.processors.action._get_integration_features",
                return_value=frozenset({IntegrationFeatures.ALERT_RULE}),
            ),
        ):
            with self.feature(
                {
                    "organizations:seer-automations": False,
                    "organizations:integrations-alert-rule": True,
                }
            ):
                assert not is_action_permitted(Action.Type.SLACK, self.organization)

            with self.feature(
                {
                    "organizations:seer-automations": True,
                    "organizations:integrations-alert-rule": False,
                }
            ):
                assert not is_action_permitted(Action.Type.SLACK, self.organization)

            with self.feature(
                {
                    "organizations:seer-automations": True,
                    "organizations:integrations-alert-rule": True,
                }
            ):
                assert is_action_permitted(Action.Type.SLACK, self.organization)

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


@freeze_time("2024-01-09")
class TestInboxActionFrequency(BaseWorkflowTest):
    def setUp(self) -> None:
        self.inbox = self.create_workflow(type=Workflow.Type.INBOX, config={"frequency": 1440})
        self.inbox_group, self.inbox_action = self.create_workflow_action(
            self.inbox,
            action=self.create_action(
                type=Action.Type.EMAIL,
                config={"target_type": ActionTarget.USER, "target_identifier": str(self.user.id)},
            ),
        )
        self.alert = self.create_workflow(config={"frequency": 30})
        self.alert_group, self.alert_action = self.create_workflow_action(self.alert)
        self.activity = Activity(
            project=self.project,
            group=self.group,
            type=ActivityType.ASSIGNED.value,
            data={"assignee": str(self.user.id)},
        )
        self.activity.save()
        self.event_data = WorkflowEventData(event=self.activity, group=self.group)
        self.groups = {self.inbox_group, self.alert_group}

    def test_inbox_only_does_not_access_frequency_state(self) -> None:
        with (
            patch(
                "sentry.workflow_engine.processors.action.get_workflow_action_group_statuses"
            ) as read,
            patch(
                "sentry.workflow_engine.processors.action.update_workflow_action_group_statuses"
            ) as write,
        ):
            actions, _, workflows = filter_recently_fired_workflow_actions(
                {self.inbox_group}, self.event_data
            )
        assert list(actions) == [self.inbox_action]
        assert workflows == {self.inbox.id}
        read.assert_not_called()
        write.assert_not_called()

    def test_group_less_event_excludes_alerts_and_unsupported_actions(self) -> None:
        event_data = WorkflowEventData(
            event=OrganizationEvent(organization_id=self.organization.id, event_id=uuid4()),
            organization=self.organization,
        )
        unsupported_group, _ = self.create_workflow_action(self.inbox)
        with patch.object(self.inbox_action.get_handler(), "supports_group_less", True):
            actions, attribution, workflows = filter_recently_fired_workflow_actions(
                self.groups | {unsupported_group}, event_data
            )
        assert list(actions) == [self.inbox_action]
        assert attribution == {self.inbox_action.id: self.inbox.id}
        assert workflows == {self.inbox.id}
        assert not WorkflowActionGroupStatus.objects.exists()

    def test_shared_action_records_only_eligible_workflows(self) -> None:
        shared_group, _ = self.create_workflow_action(self.alert, action=self.inbox_action)
        groups = {self.inbox_group, shared_group}
        actions, attribution, workflows = filter_recently_fired_workflow_actions(
            groups, self.event_data
        )
        assert list(actions) == [self.inbox_action]
        assert workflows == {self.inbox.id, self.alert.id}
        assert attribution == {self.inbox_action.id: min(workflows)}
        histories = create_workflow_fire_histories(
            actions, self.event_data, eligible_workflow_ids=workflows
        )
        assert {history.workflow_id for history in histories} == workflows

        # On the next evaluation only Inbox remains eligible for the shared action.
        actions, attribution, workflows = filter_recently_fired_workflow_actions(
            groups, self.event_data
        )
        assert list(actions) == [self.inbox_action]
        assert attribution == {self.inbox_action.id: self.inbox.id}
        assert workflows == {self.inbox.id}
        histories = create_workflow_fire_histories(
            actions, self.event_data, eligible_workflow_ids=workflows
        )
        assert {history.workflow_id for history in histories} == {self.inbox.id}

    def test_alert_insert_conflict_does_not_drop_shared_inbox_action(self) -> None:
        self.create_data_condition_group_action(
            condition_group=self.alert_group, action=self.inbox_action
        )
        with patch(
            "sentry.workflow_engine.processors.action.update_workflow_action_group_statuses",
            return_value=StatusUpdateResult(
                updated=0,
                created=0,
                not_created=[
                    (self.alert.id, self.inbox_action.id),
                    (self.alert.id, self.alert_action.id),
                ],
            ),
        ):
            actions, attribution, workflows = filter_recently_fired_workflow_actions(
                self.groups, self.event_data
            )
        assert list(actions) == [self.inbox_action]
        assert attribution == {self.inbox_action.id: self.inbox.id}
        assert workflows == {self.inbox.id}

    def test_equivalent_inbox_actions_dispatch_once_per_evaluation(self) -> None:
        duplicate = self.create_action(type=Action.Type.EMAIL, config=self.inbox_action.config)
        duplicate_group, _ = self.create_workflow_action(self.inbox, action=duplicate)
        groups = {self.inbox_group, duplicate_group}
        with patch(
            "sentry.workflow_engine.processors.action.trigger_action.apply_async"
        ) as enqueue:
            actions, attribution, _ = filter_recently_fired_workflow_actions(
                groups, self.event_data
            )
            fire_actions(actions, self.event_data, {}, attribution)
            assert enqueue.call_count == 1
            actions, attribution, _ = filter_recently_fired_workflow_actions(
                groups, self.event_data
            )
            fire_actions(actions, self.event_data, {}, attribution)
            assert enqueue.call_count == 2
        assert not WorkflowActionGroupStatus.objects.exists()

    def test_excludes_other_organizations(self) -> None:
        foreign = self.create_workflow(
            type=Workflow.Type.INBOX, organization=self.create_organization()
        )
        foreign_group, _ = self.create_workflow_action(foreign)
        actions, attribution, workflows = filter_recently_fired_workflow_actions(
            {foreign_group}, self.event_data
        )
        assert list(actions) == []
        assert attribution == {}
        assert workflows == set()
        assert not WorkflowActionGroupStatus.objects.exists()

    def test_mixed_activity_processing_preserves_throttle_and_notification_uuid(self) -> None:
        # Prime only the alert's throttle, then evaluate both workflows normally.
        filter_recently_fired_workflow_actions({self.alert_group}, self.event_data)
        status = WorkflowActionGroupStatus.objects.get()
        status.update(date_updated=timezone.now() - timedelta(minutes=1))
        previous_date = status.date_updated
        detector = self.create_detector(project=self.project)
        with (
            patch(
                "sentry.workflow_engine.processors.workflow.get_workflows_by_detectors",
                return_value={self.inbox, self.alert},
            ),
            patch("sentry.workflow_engine.processors.action.trigger_action.apply_async") as enqueue,
        ):
            result = process_workflows(
                DelayedWorkflowClient(), self.event_data, timezone.now(), detector=detector
            )
        assert result.has_triggered_actions()
        enqueue.assert_called_once()
        params = enqueue.call_args.kwargs["kwargs"]
        assert params["action_id"] == self.inbox_action.id
        assert params["workflow_id"] == self.inbox.id
        assert params["activity_id"] == self.activity.id
        history = WorkflowFireHistory.objects.get()
        assert history.workflow_id == self.inbox.id
        assert params["notification_uuid"] == str(history.notification_uuid)
        status.refresh_from_db()
        assert status.date_updated == previous_date
        assert WorkflowActionGroupStatus.objects.count() == 1
