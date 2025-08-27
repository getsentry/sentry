from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest

from sentry.eventstream.types import EventStreamEventType
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.incidents.utils.types import ProcessedSubscriptionUpdate
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.status_change_consumer import update_status
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.models.group import Group
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.services import eventstore
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery, SnubaQueryEventType
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.tasks.post_process import post_process_group
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.features import Feature
from sentry.types.activity import ActivityType
from sentry.workflow_engine.models import DataPacket, Detector
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.processors.data_packet import process_data_packet
from sentry.workflow_engine.types import DetectorPriorityLevel
from tests.sentry.incidents.utils.test_metric_issue_base import BaseMetricIssueTest
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


@patch("sentry.workflow_engine.tasks.actions.trigger_action.apply_async")
class MetricIssueIntegrationTest(BaseWorkflowTest, BaseMetricIssueTest):
    def setUp(self) -> None:
        super().setUp()
        self.critical_action, self.warning_action = self.create_metric_issue_workflow(self.detector)

    @pytest.fixture(autouse=True)
    def with_feature_flags(self):
        with Feature(
            {
                "organizations:issue-metric-issue-ingest": True,
                "organizations:issue-metric-issue-post-process-group": True,
                "organizations:workflow-engine-single-process-metric-issues": True,
                "organizations:issue-open-periods": True,
            }
        ):
            yield

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
        assert event
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

    @with_feature("organizations:workflow-engine-metric-alert-processing")
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


@patch("sentry.workflow_engine.tasks.actions.trigger_action.apply_async")
class TestMetricIssueGroupByIntegration(BaseWorkflowTest, BaseMetricIssueTest):
    def setUp(self) -> None:
        super().setUp()
        # Override the base snuba query to include group_by
        with self.tasks():
            self.snuba_query = create_snuba_query(
                query_type=SnubaQuery.Type.ERROR,
                dataset=Dataset.Events,
                query="hello",
                aggregate="count()",
                time_window=timedelta(minutes=1),
                resolution=timedelta(minutes=1),
                environment=self.environment,
                event_types=[SnubaQueryEventType.EventType.ERROR],
                group_by=["level"],
            )
            self.query_subscription = create_snuba_subscription(
                project=self.detector.project,
                subscription_type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
                snuba_query=self.snuba_query,
            )

        # Create data source - needed for data packet processing
        from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION

        self.data_source = self.create_data_source(
            organization=self.organization,
            source_id=str(self.query_subscription.id),
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )
        self.create_data_source_detector(self.data_source, self.detector)

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
        assert event
        return Group.objects.get(id=event.group_id)

    @pytest.fixture(autouse=True)
    def with_feature_flags(self):
        with Feature(
            {
                "organizations:issue-metric-issue-ingest": True,
                "organizations:issue-metric-issue-post-process-group": True,
                "organizations:workflow-engine-single-process-metric-issues": True,
                "organizations:issue-open-periods": True,
            }
        ):
            yield

    def create_grouped_subscription_packet(
        self, group_values: dict[str, int], time_jump: int = 0
    ) -> DataPacket[ProcessedSubscriptionUpdate]:
        """Create a data packet with grouped values structure"""
        groups = []
        for group_key, value in group_values.items():
            groups.append(
                {
                    "group_keys": {"level": group_key},
                    "value": value,
                }
            )

        packet = ProcessedSubscriptionUpdate(
            entity="entity",
            subscription_id=str(self.query_subscription.id),
            values={"groups": groups},
            timestamp=datetime.now(timezone.utc) + timedelta(minutes=time_jump),
        )
        return DataPacket[ProcessedSubscriptionUpdate](
            source_id=str(self.query_subscription.id), packet=packet
        )

    def process_grouped_packet_and_return_results(
        self, data_packet: DataPacket
    ) -> dict[str, IssueOccurrence]:
        """Process a grouped data packet and return occurrences by group key"""
        from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION

        results = process_data_packet(data_packet, DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION)
        if not results:
            return {}

        occurrences = {}
        for detector_id, group_results in results:
            for group_key, evaluation_result in group_results.items():
                if isinstance(evaluation_result.result, IssueOccurrence):
                    occurrences[group_key] = evaluation_result.result
        return occurrences

    def test_grouped_data_triggers_workflows(self, mock_trigger: MagicMock) -> None:
        """Test that grouped data with multiple groups exceeding thresholds triggers workflows correctly"""
        # Create data packet with multiple groups: error (critical) and warning (medium priority)
        group_values = {
            "error": self.critical_detector_trigger.comparison + 1,  # 6, triggers critical
            "warning": self.warning_detector_trigger.comparison + 1,  # 4, triggers warning
            "info": 1,  # 1, below both thresholds
        }
        data_packet = self.create_grouped_subscription_packet(group_values)
        occurrences = self.process_grouped_packet_and_return_results(data_packet)

        # Verify we got occurrences for the triggering groups
        assert len(occurrences) == 2
        assert "level=error" in occurrences
        assert "level=warning" in occurrences
        assert "level=info" not in occurrences

        # Verify group keys appear in subtitles
        error_occurrence = occurrences["level=error"]
        warning_occurrence = occurrences["level=warning"]
        assert "level=error Critical:" in error_occurrence.subtitle
        assert "level=warning Warning:" in warning_occurrence.subtitle

        # Save occurrences and trigger post processing
        for occurrence in occurrences.values():
            occurrence.save()
            self.call_post_process_group(occurrence)

        # Verify workflows were triggered correctly
        # Error group should trigger both critical and warning actions (escalation)
        # Warning group should trigger only warning action
        assert mock_trigger.call_count == 3  # 2 actions for error + 1 action for warning

    def test_grouped_escalation(self, mock_trigger: MagicMock) -> None:
        """Test priority escalation within a specific group"""
        # First: error group at warning level
        group_values = {"error": self.warning_detector_trigger.comparison + 1}  # 4
        data_packet = self.create_grouped_subscription_packet(group_values)
        occurrences = self.process_grouped_packet_and_return_results(data_packet)

        assert len(occurrences) == 1
        error_occurrence = occurrences["level=error"]
        assert "level=error Warning:" in error_occurrence.subtitle
        error_occurrence.save()
        self.call_post_process_group(error_occurrence)
        assert mock_trigger.call_count == 1  # warning action only

        mock_trigger.reset_mock()

        # Second: error group escalates to critical level
        group_values = {"error": self.critical_detector_trigger.comparison + 1}  # 6
        data_packet = self.create_grouped_subscription_packet(group_values, time_jump=1000)
        occurrences = self.process_grouped_packet_and_return_results(data_packet)

        assert len(occurrences) == 1
        error_occurrence = occurrences["level=error"]
        assert "level=error Critical:" in error_occurrence.subtitle
        error_occurrence.save()
        self.call_post_process_group(error_occurrence)
        assert mock_trigger.call_count == 2  # both warning and critical actions

    @with_feature("organizations:workflow-engine-metric-alert-processing")
    def test_grouped_resolution(self, mock_trigger: MagicMock) -> None:
        """Test resolution for specific groups"""
        # Initial: trigger critical for error group
        group_values = {"error": self.critical_detector_trigger.comparison + 1}  # 6
        data_packet = self.create_grouped_subscription_packet(group_values)
        occurrences = self.process_grouped_packet_and_return_results(data_packet)

        assert len(occurrences) == 1
        error_occurrence = occurrences["level=error"]
        error_occurrence.save()
        group = self.get_group(error_occurrence)
        self.call_post_process_group(error_occurrence)
        assert mock_trigger.call_count == 2  # both actions

        mock_trigger.reset_mock()

        # Resolution: bring error group back below threshold
        group_values = {"error": 0}  # Below threshold
        data_packet = self.create_grouped_subscription_packet(group_values, time_jump=1000)
        from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION

        results = process_data_packet(data_packet, DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION)
        assert results

        # Should get a status change message for resolution
        for detector_id, group_results in results:
            for group_key, evaluation_result in group_results.items():
                if isinstance(evaluation_result.result, StatusChangeMessage):
                    message = evaluation_result.result.to_dict()
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
