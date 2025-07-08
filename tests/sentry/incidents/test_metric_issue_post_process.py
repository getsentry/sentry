from unittest.mock import patch

import pytest

from sentry import eventstore
from sentry.eventstream.types import EventStreamEventType
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.status_change_consumer import update_status
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.models.group import Group
from sentry.tasks.post_process import post_process_group
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.features import Feature
from sentry.types.activity import ActivityType
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel
from tests.sentry.incidents.utils.test_metric_issue_base import BaseMetricIssueTest
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


@patch("sentry.workflow_engine.processors.workflow.Action.trigger")
class MetricIssueIntegrationTest(BaseWorkflowTest, BaseMetricIssueTest):
    def setUp(self):
        super().setUp()
        self.critical_action, self.warning_action = self.create_metric_issue_workflow(self.detector)

    @pytest.fixture(autouse=True)
    def with_feature_flags(self):
        with Feature(
            {
                "organizations:issue-metric-issue-ingest": True,
                "organizations:issue-metric-issue-post-process-group": True,
                "organizations:workflow-engine-metric-alert-processing": True,
                "organizations:workflow-engine-process-metric-issue-workflows": True,
                "organizations:workflow-engine-trigger-actions": True,
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
        critical_action = self.create_action()
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

        warning_action = self.create_action()
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

    def test_simple(self, mock_trigger):
        value = self.critical_detector_trigger.comparison + 1
        data_packet = self.create_subscription_packet(value)
        occurrence = self.process_packet_and_return_result(data_packet)
        assert isinstance(occurrence, IssueOccurrence)
        occurrence.save()
        self.call_post_process_group(occurrence)

        assert mock_trigger.call_count == 2  # warning + critical actions

    def test_escalation(self, mock_trigger):
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

    def test_deescalation(self, mock_trigger):
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

    @with_feature("organizations:workflow-engine-process-activity")
    def test_resolution_from_critical(self, mock_trigger):
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
        with patch("sentry.workflow_engine.tasks.metrics.incr") as mock_incr:
            with self.tasks():
                update_status(group, message)
            mock_incr.assert_any_call(
                "workflow_engine.process_workflow.activity_update.executed",
                tags={"activity_type": ActivityType.SET_RESOLVED.value},
            )

    @with_feature("organizations:workflow-engine-process-activity")
    def test_resolution_from_warning(self, mock_trigger):
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
        # TODO: Actions don't trigger on resolution yet. Update this test when this functionality exists.
        with patch("sentry.workflow_engine.tasks.metrics.incr") as mock_incr:
            with self.tasks():
                update_status(group, message)
            mock_incr.assert_any_call(
                "workflow_engine.process_workflow.activity_update.executed",
                tags={"activity_type": ActivityType.SET_RESOLVED.value},
            )
