from datetime import UTC, datetime, timedelta
from unittest.mock import patch

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
from sentry.testutils.helpers.features import with_feature
from sentry.workflow_engine.models import DataPacket
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import (
    DetectorEvaluationResult,
    DetectorGroupKey,
    DetectorPriorityLevel,
)
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestMetricDetectorPostProcess(BaseWorkflowTest):
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

    @with_feature("organizations:issue-metric-issue-ingest")
    @with_feature("organizations:issue-metric-issue-post-process-group")
    @with_feature("organizations:workflow-engine-metric-alert-processing")
    @with_feature("organizations:workflow-engine-process-metric-issue-workflows")
    @patch("sentry.workflow_engine.tasks.workflows.process_workflows_event.delay")
    def test_occurrence_post_process(self, mock_process_workflows):
        value = self.critical_detector_trigger.comparison + 1
        packet = QuerySubscriptionUpdate(
            entity="entity",
            subscription_id=str(self.query_subscription.id),
            values={"value": value},
            timestamp=datetime.now(UTC),
        )
        data_packet = DataPacket[QuerySubscriptionUpdate](
            source_id=str(self.query_subscription.id), packet=packet
        )
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
        assert mock_process_workflows.call_count == 1
