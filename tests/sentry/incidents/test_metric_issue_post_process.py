from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest

from sentry import eventstore
from sentry.eventstream.types import EventStreamEventType
from sentry.incidents.grouptype import MetricIssue, MetricIssueDetectorHandler
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.incidents.utils.types import QuerySubscriptionUpdate
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery, SnubaQueryEventType
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.tasks.post_process import post_process_group
from sentry.testutils.helpers.features import Feature
from sentry.workflow_engine.models import DataPacket, Detector
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import (
    DetectorEvaluationResult,
    DetectorGroupKey,
    DetectorPriorityLevel,
)
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


@patch("sentry.workflow_engine.processors.workflow.Action.trigger")
class MetricIssueIntegrationTest(BaseWorkflowTest):
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

    def create_data_packet(self, value: int, time_jump: int = 0) -> DataPacket:
        packet = QuerySubscriptionUpdate(
            entity="entity",
            subscription_id=str(self.query_subscription.id),
            values={"value": value},
            timestamp=datetime.now(UTC) + timedelta(minutes=time_jump),
        )
        return DataPacket[QuerySubscriptionUpdate](
            source_id=str(self.query_subscription.id), packet=packet
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

    def setUp(self):
        super().setUp()
        self.detector_group_key = None
        self.detector = self.create_detector(
            project=self.project,
            workflow_condition_group=self.create_data_condition_group(),
            type=MetricIssue.slug,
            created_by_id=self.user.id,
        )
        self.critical_detector_trigger = self.create_data_condition(
            type=Condition.GREATER,
            comparison=5,
            condition_result=DetectorPriorityLevel.HIGH,
            condition_group=self.detector.workflow_condition_group,
        )
        self.warning_detector_trigger = self.create_data_condition(
            comparison=3,
            type=Condition.GREATER,
            condition_result=DetectorPriorityLevel.MEDIUM,
            condition_group=self.detector.workflow_condition_group,
        )
        self.resolve_detector_trigger = self.create_data_condition(
            type=Condition.LESS,
            comparison=3,
            condition_result=DetectorPriorityLevel.OK,
            condition_group=self.detector.workflow_condition_group,
        )

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
            )
            self.query_subscription = create_snuba_subscription(
                project=self.detector.project,
                subscription_type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
                snuba_query=self.snuba_query,
            )
        self.alert_rule = self.create_alert_rule()
        self.create_alert_rule_detector(alert_rule_id=self.alert_rule.id, detector=self.detector)

        self.handler = MetricIssueDetectorHandler(self.detector)
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

    def test_simple(self, mock_trigger):
        value = self.critical_detector_trigger.comparison + 1
        data_packet = self.create_data_packet(value)
        result: dict[DetectorGroupKey, DetectorEvaluationResult] = self.handler.evaluate(
            data_packet
        )
        evaluation_result: DetectorEvaluationResult = result[self.detector_group_key]
        assert isinstance(evaluation_result.result, IssueOccurrence)
        occurrence: IssueOccurrence = evaluation_result.result

        assert occurrence is not None

        produce_occurrence_to_kafka(
            payload_type=PayloadType.OCCURRENCE,
            occurrence=occurrence,
            event_data=evaluation_result.event_data,
        )
        occurrence.save()
        self.call_post_process_group(occurrence)

        assert mock_trigger.call_count == 2  # warning + critical actions

    def test_escalation(self, mock_trigger):
        value = self.warning_detector_trigger.comparison + 1
        data_packet = self.create_data_packet(value)
        result: dict[DetectorGroupKey, DetectorEvaluationResult] = self.handler.evaluate(
            data_packet
        )
        evaluation_result: DetectorEvaluationResult = result[self.detector_group_key]
        assert isinstance(evaluation_result.result, IssueOccurrence)
        occurrence: IssueOccurrence = evaluation_result.result

        assert occurrence is not None

        produce_occurrence_to_kafka(
            payload_type=PayloadType.OCCURRENCE,
            occurrence=occurrence,
            event_data=evaluation_result.event_data,
        )
        occurrence.save()
        self.call_post_process_group(occurrence)

        assert mock_trigger.call_count == 1  # just warning action

        mock_trigger.reset_mock()

        value = self.critical_detector_trigger.comparison + 1
        data_packet = self.create_data_packet(value, 30)
        result = self.handler.evaluate(data_packet)
        evaluation_result = result[self.detector_group_key]
        assert isinstance(evaluation_result.result, IssueOccurrence)
        occurrence = evaluation_result.result

        assert occurrence is not None

        produce_occurrence_to_kafka(
            payload_type=PayloadType.OCCURRENCE,
            occurrence=occurrence,
            event_data=evaluation_result.event_data,
        )
        occurrence.save()
        self.call_post_process_group(occurrence)
        assert mock_trigger.call_count == 2  # warning + critical actions

    def test_deescalation(self, mock_trigger):
        value = self.critical_detector_trigger.comparison + 1
        data_packet = self.create_data_packet(value)
        result: dict[DetectorGroupKey, DetectorEvaluationResult] = self.handler.evaluate(
            data_packet
        )
        evaluation_result: DetectorEvaluationResult = result[self.detector_group_key]
        assert isinstance(evaluation_result.result, IssueOccurrence)
        occurrence: IssueOccurrence = evaluation_result.result

        assert occurrence is not None

        produce_occurrence_to_kafka(
            payload_type=PayloadType.OCCURRENCE,
            occurrence=occurrence,
            event_data=evaluation_result.event_data,
        )
        occurrence.save()
        self.call_post_process_group(occurrence)

        assert mock_trigger.call_count == 2  # both actions

        mock_trigger.reset_mock()

        value = self.warning_detector_trigger.comparison + 1
        data_packet = self.create_data_packet(value, 30)
        result = self.handler.evaluate(data_packet)
        evaluation_result = result[self.detector_group_key]
        assert isinstance(evaluation_result.result, IssueOccurrence)
        occurrence = evaluation_result.result

        assert occurrence is not None

        produce_occurrence_to_kafka(
            payload_type=PayloadType.OCCURRENCE,
            occurrence=occurrence,
            event_data=evaluation_result.event_data,
        )
        occurrence.save()
        self.call_post_process_group(occurrence)
        assert mock_trigger.call_count == 2  # both actions
