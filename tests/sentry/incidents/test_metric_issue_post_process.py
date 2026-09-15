from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

from django.utils import timezone

from sentry.eventstream.types import EventStreamEventType
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.incident import IncidentStatus, TriggerStatus
from sentry.incidents.subscription_processor import SubscriptionProcessor
from sentry.incidents.utils.types import QuerySubscriptionUpdate
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.status_change_consumer import update_status
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.models.group import Group, GroupStatus
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.notification_action.metric_alert_registry.handlers.slack_metric_alert_handler import (
    SlackMetricAlertHandler,
)
from sentry.services import eventstore
from sentry.tasks.post_process import post_process_group
from sentry.testutils.helpers.datetime import freeze_time
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus
from sentry.workflow_engine.models import Detector, DetectorState
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.tasks.actions import trigger_action
from sentry.workflow_engine.tasks.workflows import process_workflow_activity
from sentry.workflow_engine.types import DetectorPriorityLevel
from tests.sentry.incidents.utils.test_metric_issue_base import BaseMetricIssueTest
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class MetricIssueWorkflowTestCase(BaseWorkflowTest, BaseMetricIssueTest):
    def setUp(self) -> None:
        super().setUp()
        self.critical_action, self.warning_action = self.create_metric_issue_workflow(self.detector)

    def create_metric_issue_workflow(self, detector: Detector):
        # create the canonical workflow for a metric issue
        workflow = self.create_workflow()
        self.create_detector_workflow(detector=detector, workflow=workflow)

        critical_dcg = self.create_data_condition_group(organization=self.organization)
        self.create_workflow_data_condition_group(condition_group=critical_dcg, workflow=workflow)
        self.create_data_condition(
            comparison=DetectorPriorityLevel.HIGH,
            condition_result=True,
            type=Condition.ISSUE_PRIORITY_GREATER_OR_EQUAL,
            condition_group=critical_dcg,
        )

        self.create_data_condition(
            comparison=DetectorPriorityLevel.HIGH,
            condition_result=True,
            type=Condition.ISSUE_PRIORITY_DEESCALATING,
            condition_group=critical_dcg,
        )

        critical_action = self.create_action(
            integration_id=self.integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": "channel-123",
                "target_display": "Test Channel",
            },
        )

        self.create_data_condition_group_action(critical_action, critical_dcg)

        warning_dcg = self.create_data_condition_group(organization=self.organization)
        self.create_workflow_data_condition_group(condition_group=warning_dcg, workflow=workflow)
        self.create_data_condition(
            comparison=DetectorPriorityLevel.MEDIUM,
            condition_result=True,
            type=Condition.ISSUE_PRIORITY_GREATER_OR_EQUAL,
            condition_group=warning_dcg,
        )

        self.create_data_condition(
            comparison=DetectorPriorityLevel.MEDIUM,
            condition_result=True,
            type=Condition.ISSUE_PRIORITY_DEESCALATING,
            condition_group=warning_dcg,
        )
        warning_action = self.create_action(
            integration_id=self.integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": "channel-456",
                "target_display": "Test Channel",
            },
        )

        self.create_data_condition_group_action(warning_action, warning_dcg)

        return (
            critical_action,
            warning_action,
        )


@patch.object(SlackMetricAlertHandler, "send_alert")
class MetricIssueSubscriptionIntegrationTest(MetricIssueWorkflowTestCase):
    def setUp(self) -> None:
        super().setUp()
        # One threshold with no hysteresis, evaluated every minute.
        self.warning_detector_trigger.delete()
        self.warning_action.delete()
        self.resolve_detector_trigger.update(
            type=Condition.LESS_OR_EQUAL,
            comparison=self.critical_detector_trigger.comparison,
        )
        self.start = timezone.now().replace(microsecond=0) - timedelta(minutes=10)

    def process_subscription_update(self, value: int, timestamp: datetime) -> Group:
        subscription_update: QuerySubscriptionUpdate = {
            "entity": "events",
            "subscription_id": self.query_subscription.subscription_id,
            "values": {"data": [{"value": value}]},
            "timestamp": timestamp,
        }
        # Keep the production consumer, occurrence ingestion, status activities,
        # post-processing, workflow filters and action tasks real. Only Slack delivery
        # is mocked. The local eventstream dispatches post-processing synchronously.
        with (
            freeze_time(timestamp),
            self.tasks(),
            self.capture_on_commit_callbacks(execute=True),
        ):
            assert SubscriptionProcessor.process(self.query_subscription, subscription_update)

        return Group.objects.get(project=self.project, type=MetricIssue.type_id)

    def test_opens_and_resolves_on_every_subscription_evaluation(
        self, mock_send_alert: MagicMock
    ) -> None:
        group = self.process_subscription_update(6, self.start)
        first_period = GroupOpenPeriod.objects.get(group=group)
        assert group.status == GroupStatus.UNRESOLVED
        assert (
            DetectorState.objects.get(detector=self.detector).priority_level
            == DetectorPriorityLevel.HIGH
        )
        assert first_period.date_ended is None
        assert mock_send_alert.call_count == 1

        group = self.process_subscription_update(5, self.start + timedelta(minutes=1))
        first_period.refresh_from_db()
        assert group.status == GroupStatus.RESOLVED
        assert first_period.date_ended == self.start + timedelta(minutes=1)
        assert (
            DetectorState.objects.get(detector=self.detector).priority_level
            == DetectorPriorityLevel.OK
        )
        assert mock_send_alert.call_count == 2

        group = self.process_subscription_update(6, self.start + timedelta(minutes=2))
        second_period = GroupOpenPeriod.objects.get(group=group, date_ended__isnull=True)
        assert second_period.id != first_period.id
        assert second_period.date_started == self.start + timedelta(minutes=2)
        assert group.status == GroupStatus.UNRESOLVED
        assert mock_send_alert.call_count == 3

        group = self.process_subscription_update(5, self.start + timedelta(minutes=3))
        second_period.refresh_from_db()
        assert group.status == GroupStatus.RESOLVED
        assert second_period.date_ended == self.start + timedelta(minutes=3)
        assert GroupOpenPeriod.objects.filter(group=group).count() == 2

        notifications = [call.kwargs for call in mock_send_alert.call_args_list]
        assert [notification["notification_context"].id for notification in notifications] == [
            self.critical_action.id
        ] * 4
        assert [
            (
                notification["trigger_status"],
                notification["metric_issue_context"].new_status,
                notification["metric_issue_context"].metric_value,
                notification["open_period_context"].id,
            )
            for notification in notifications
        ] == [
            (TriggerStatus.ACTIVE, IncidentStatus.CRITICAL, 6, first_period.id),
            (TriggerStatus.RESOLVED, IncidentStatus.CLOSED, 5, first_period.id),
            (TriggerStatus.ACTIVE, IncidentStatus.CRITICAL, 6, second_period.id),
            (TriggerStatus.RESOLVED, IncidentStatus.CLOSED, 5, second_period.id),
        ]

    def test_delayed_resolution_action_keeps_its_original_open_period(
        self, mock_send_alert: MagicMock
    ) -> None:
        group = self.process_subscription_update(6, self.start)
        first_period = GroupOpenPeriod.objects.get(group=group)
        assert mock_send_alert.call_count == 1

        # Hold only the action-task boundary; let both subscription evaluations,
        # issue transitions and workflow/action-filter evaluations complete normally.
        with patch.object(trigger_action, "apply_async") as queued_actions:
            self.process_subscription_update(5, self.start + timedelta(minutes=1))
            group = self.process_subscription_update(6, self.start + timedelta(minutes=2))

        first_period.refresh_from_db()
        second_period = GroupOpenPeriod.objects.get(group=group, date_ended__isnull=True)
        assert second_period.id != first_period.id
        assert queued_actions.call_count == 2
        resolution_kwargs = queued_actions.call_args_list[0].kwargs["kwargs"]
        reopening_kwargs = queued_actions.call_args_list[1].kwargs["kwargs"]
        assert resolution_kwargs["activity_id"] == first_period.resolution_activity_id
        assert resolution_kwargs["event_id"] is None
        assert reopening_kwargs["activity_id"] is None
        assert reopening_kwargs["event_id"] is not None
        assert (
            resolution_kwargs["action_id"]
            == reopening_kwargs["action_id"]
            == self.critical_action.id
        )

        # Even FIFO action execution is unsafe if a later evaluation has reopened
        # the group: the recovery must still close the FIRST notification thread.
        with freeze_time(self.start + timedelta(minutes=2, seconds=5)):
            trigger_action(**resolution_kwargs)
            trigger_action(**reopening_kwargs)

        assert mock_send_alert.call_count == 3
        assert [
            (
                call.kwargs["trigger_status"],
                call.kwargs["metric_issue_context"].new_status,
                call.kwargs["open_period_context"].id,
            )
            for call in mock_send_alert.call_args_list
        ] == [
            (TriggerStatus.ACTIVE, IncidentStatus.CRITICAL, first_period.id),
            (TriggerStatus.RESOLVED, IncidentStatus.CLOSED, first_period.id),
            (TriggerStatus.ACTIVE, IncidentStatus.CRITICAL, second_period.id),
        ]

    def test_delayed_resolution_workflow_uses_the_closed_period_priority(
        self, mock_send_alert: MagicMock
    ) -> None:
        self.create_data_condition(
            comparison=3,
            type=Condition.GREATER,
            condition_result=DetectorPriorityLevel.MEDIUM,
            condition_group=self.detector.workflow_condition_group,
        )
        self.resolve_detector_trigger.update(comparison=3)
        group = self.process_subscription_update(6, self.start)
        first_period = GroupOpenPeriod.objects.get(group=group)
        assert mock_send_alert.call_count == 1

        # This time hold the resolution workflow itself, before its de-escalation
        # filter has run. The next open period only reaches warning priority.
        with patch.object(process_workflow_activity, "delay") as queued_workflows:
            self.process_subscription_update(2, self.start + timedelta(minutes=1))
        queued_workflows.assert_called_once()
        resolution_kwargs = queued_workflows.call_args.kwargs
        first_period.refresh_from_db()
        assert resolution_kwargs["activity_id"] == first_period.resolution_activity_id

        group = self.process_subscription_update(4, self.start + timedelta(minutes=2))
        second_period = GroupOpenPeriod.objects.get(group=group, date_ended__isnull=True)
        assert second_period.id != first_period.id
        assert group.priority == DetectorPriorityLevel.MEDIUM
        assert mock_send_alert.call_count == 1  # Critical-only action must not fire for warning.

        with freeze_time(self.start + timedelta(minutes=2, seconds=5)), self.tasks():
            process_workflow_activity(**resolution_kwargs)

        # Recovering the critical period must not depend on a later period's priority.
        assert mock_send_alert.call_count == 2
        recovery = mock_send_alert.call_args.kwargs
        assert recovery["trigger_status"] == TriggerStatus.RESOLVED
        assert recovery["open_period_context"].id == first_period.id


@patch("sentry.workflow_engine.tasks.actions.trigger_action.apply_async")
class MetricIssueIntegrationTest(MetricIssueWorkflowTestCase):
    def call_post_process_group(self, occurrence):
        stored_occurrence = IssueOccurrence.fetch(occurrence.id, occurrence.project_id)
        assert stored_occurrence
        event = eventstore.backend.get_event_by_id(
            occurrence.project_id, stored_occurrence.event_id
        )
        assert event
        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=True,
                cache_key=None,
                occurrence_id=occurrence.id,
                group_id=event.group_id,
                project_id=occurrence.project_id,
                eventstream_type=EventStreamEventType.Generic.value,
            )

    def get_group(self, occurrence):
        stored_occurrence = IssueOccurrence.fetch(occurrence.id, occurrence.project_id)
        assert stored_occurrence
        event = eventstore.backend.get_event_by_id(
            occurrence.project_id, stored_occurrence.event_id
        )
        assert event and event.group_id
        return Group.objects.get(id=event.group_id)

    def test_simple(self, mock_trigger: MagicMock) -> None:
        value = self.critical_detector_trigger.comparison + 1
        data_packet = self.create_subscription_packet(value)
        occurrence = self.process_packet_and_return_result(data_packet)
        assert isinstance(occurrence, IssueOccurrence)
        occurrence.save()
        self.call_post_process_group(occurrence)

        assert mock_trigger.call_count == 2  # warning + critical actions

    def test_escalation(self, mock_trigger: MagicMock) -> None:
        value = self.warning_detector_trigger.comparison + 1
        data_packet = self.create_subscription_packet(value)
        occurrence = self.process_packet_and_return_result(data_packet)
        assert isinstance(occurrence, IssueOccurrence)
        occurrence.save()
        self.call_post_process_group(occurrence)
        assert mock_trigger.call_count == 1  # just warning action

        mock_trigger.reset_mock()

        value = self.critical_detector_trigger.comparison + 1
        data_packet = self.create_subscription_packet(value, 1000)
        occurrence = self.process_packet_and_return_result(data_packet)
        assert isinstance(occurrence, IssueOccurrence)
        occurrence.save()
        self.call_post_process_group(occurrence)
        assert mock_trigger.call_count == 2  # warning + critical actions

    def test_escalation_with_deduped_actions(self, mock_trigger: MagicMock) -> None:
        # make the warning action same as the critical action
        self.warning_action.config = self.critical_action.config
        self.warning_action.save()

        value = self.warning_detector_trigger.comparison + 1
        data_packet = self.create_subscription_packet(value)
        occurrence = self.process_packet_and_return_result(data_packet)
        assert isinstance(occurrence, IssueOccurrence)
        occurrence.save()
        self.call_post_process_group(occurrence)
        assert mock_trigger.call_count == 1  # just warning action

        mock_trigger.reset_mock()

        value = self.critical_detector_trigger.comparison + 1
        data_packet = self.create_subscription_packet(value, 1000)
        occurrence = self.process_packet_and_return_result(data_packet)
        assert isinstance(occurrence, IssueOccurrence)
        occurrence.save()
        self.call_post_process_group(occurrence)
        assert mock_trigger.call_count == 1  # just warning action (because we deduped the actions)

    def test_deescalation(self, mock_trigger: MagicMock) -> None:
        value = self.critical_detector_trigger.comparison + 1
        data_packet = self.create_subscription_packet(value)
        occurrence = self.process_packet_and_return_result(data_packet)
        assert isinstance(occurrence, IssueOccurrence)
        occurrence.save()
        self.call_post_process_group(occurrence)

        assert mock_trigger.call_count == 2  # both actions

        mock_trigger.reset_mock()

        value = self.warning_detector_trigger.comparison + 1
        data_packet = self.create_subscription_packet(value, 1000)
        occurrence = self.process_packet_and_return_result(data_packet)
        assert isinstance(occurrence, IssueOccurrence)
        occurrence.save()
        self.call_post_process_group(occurrence)
        assert mock_trigger.call_count == 2  # both actions

    def test_resolution_from_critical(self, mock_trigger: MagicMock) -> None:
        value = self.critical_detector_trigger.comparison + 1
        data_packet = self.create_subscription_packet(value)
        occurrence = self.process_packet_and_return_result(data_packet)
        assert isinstance(occurrence, IssueOccurrence)
        occurrence.save()
        group = self.get_group(occurrence)
        self.call_post_process_group(occurrence)
        assert mock_trigger.call_count == 2  # both actions

        mock_trigger.reset_mock()

        value = 0
        data_packet = self.create_subscription_packet(value, 1000)
        evaluation_result = self.process_packet_and_return_result(data_packet)
        assert isinstance(evaluation_result, StatusChangeMessage)
        message = evaluation_result.to_dict()
        # Packet processing already resolved the group; reset it so update_status creates a
        # genuine SET_RESOLVED activity, which is what dispatches workflow processing.
        group.update(status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.ONGOING)
        # TODO: Actions don't trigger on resolution yet. Update this test when this functionality exists.
        with patch("sentry.workflow_engine.tasks.workflows.metrics.incr") as mock_incr:
            with self.tasks():
                update_status(group, message)
            mock_incr.assert_any_call(
                "workflow_engine.tasks.process_workflows.activity_update.executed",
                tags={
                    "activity_type": ActivityType.SET_RESOLVED.value,
                    "detector_type": self.detector.type,
                },
                sample_rate=1.0,
            )

    def test_resolution_from_warning(self, mock_trigger: MagicMock) -> None:
        value = self.warning_detector_trigger.comparison + 1
        data_packet = self.create_subscription_packet(value)
        occurrence = self.process_packet_and_return_result(data_packet)
        assert isinstance(occurrence, IssueOccurrence)
        occurrence.save()
        group = self.get_group(occurrence)
        self.call_post_process_group(occurrence)

        assert mock_trigger.call_count == 1  # warning action

        mock_trigger.reset_mock()

        value = 0
        data_packet = self.create_subscription_packet(value, 1000)
        evaluation_result = self.process_packet_and_return_result(data_packet)
        assert isinstance(evaluation_result, StatusChangeMessage)
        message = evaluation_result.to_dict()
        # Packet processing already resolved the group; reset it so update_status creates a
        # genuine SET_RESOLVED activity, which is what dispatches workflow processing.
        group.update(status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.ONGOING)
        # TODO: Actions don't trigger on resolution yet. Update this test when this functionality exists.
        with patch("sentry.workflow_engine.tasks.workflows.metrics.incr") as mock_incr:
            with self.tasks():
                update_status(group, message)
            mock_incr.assert_any_call(
                "workflow_engine.tasks.process_workflows.activity_update.executed",
                tags={
                    "activity_type": ActivityType.SET_RESOLVED.value,
                    "detector_type": self.detector.type,
                },
                sample_rate=1.0,
            )
