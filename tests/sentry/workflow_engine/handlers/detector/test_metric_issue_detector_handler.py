from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from sentry.eventstream.types import EventStreamEventType
from sentry.incidents.grouptype import MetricIssueDetectorHandler
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.incidents.utils.types import QuerySubscriptionUpdate
from sentry.issues.ingest import process_occurrence_data, save_issue_occurrence
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery, SnubaQueryEventType
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.tasks.post_process import post_process_group
from sentry.testutils.helpers.datetime import freeze_time
from sentry.workflow_engine.models import DataCondition, DataPacket
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import (
    DetectorEvaluationResult,
    DetectorGroupKey,
    DetectorPriorityLevel,
)
from tests.sentry.workflow_engine.handlers.detector.test_base import BaseDetectorHandlerTest
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


@freeze_time()
class TestEvaluateMetricDetector(BaseDetectorHandlerTest, BaseWorkflowTest):
    def setUp(self):
        super().setUp()
        self.detector_group_key = None
        self.detector, self.critical_detector_trigger = self.create_detector_and_condition(
            "handler_with_state"
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

    def generate_evidence_data(
        self,
        value: int,
        detector_trigger: DataCondition,
        extra_trigger: DataCondition | None = None,
    ):
        evidence_data = {
            "detector_id": self.detector.id,
            "value": detector_trigger.condition_result,
            "alert_id": self.alert_rule.id,
            "conditions": [
                {
                    "id": detector_trigger.id,
                    "type": detector_trigger.type,
                    "comparison": detector_trigger.comparison,
                    "condition_result": detector_trigger.condition_result.value,
                },
            ],
        }
        if extra_trigger:
            evidence_data["conditions"].append(
                {
                    "id": extra_trigger.id,
                    "type": extra_trigger.type,
                    "comparison": extra_trigger.comparison,
                    "condition_result": extra_trigger.condition_result.value,
                }
            )
        return evidence_data

    def test_metric_issue_occurrence(self):
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
        evidence_data = self.generate_evidence_data(
            value, self.critical_detector_trigger, self.warning_detector_trigger
        )

        result: dict[DetectorGroupKey, DetectorEvaluationResult] = self.handler.evaluate(
            data_packet
        )
        evaluation_result: DetectorEvaluationResult = result[self.detector_group_key]
        assert isinstance(evaluation_result.result, IssueOccurrence)
        occurrence: IssueOccurrence = evaluation_result.result

        assert occurrence is not None
        assert occurrence.issue_title == self.detector.name
        assert occurrence.subtitle == self.handler.construct_title(
            snuba_query=self.snuba_query,
            detector_trigger=self.critical_detector_trigger,
            priority=self.critical_detector_trigger.condition_result,
        )
        assert occurrence.evidence_data == evidence_data
        assert occurrence.level == "error"
        assert occurrence.priority == self.critical_detector_trigger.condition_result
        assert occurrence.assignee == self.detector.created_by_id

    @patch("sentry.workflow_engine.processors.workflow.process_workflows")
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
        occurrence_data: IssueOccurrence = evaluation_result.result

        assert occurrence_data is not None

        process_occurrence_data(occurrence_data.to_dict())
        del evaluation_result.event_data["event_id"]
        del evaluation_result.event_data["project_id"]

        event = self.store_event(data=evaluation_result.event_data, project_id=self.project.id)
        occurrence, group_info = save_issue_occurrence(occurrence_data.to_dict(), event)
        assert occurrence.group
        post_process_group(
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            cache_key="dummy",
            group_id=occurrence.group_id,
            project_id=self.project_id,
            eventstream_type=EventStreamEventType.Generic.value,
        )
        assert mock_process_workflows.call_count == 1

    def test_warning_level(self):
        value = self.warning_detector_trigger.comparison + 1
        packet = QuerySubscriptionUpdate(
            entity="entity",
            subscription_id=str(self.query_subscription.id),
            values={"value": value},
            timestamp=datetime.now(UTC),
        )
        data_packet = DataPacket[QuerySubscriptionUpdate](
            source_id=str(self.query_subscription.id), packet=packet
        )
        evidence_data = self.generate_evidence_data(value, self.warning_detector_trigger)

        result: dict[DetectorGroupKey, DetectorEvaluationResult] = self.handler.evaluate(
            data_packet
        )
        evaluation_result: DetectorEvaluationResult = result[self.detector_group_key]
        assert isinstance(evaluation_result.result, IssueOccurrence)
        occurrence: IssueOccurrence = evaluation_result.result

        assert occurrence is not None
        assert occurrence.issue_title == self.detector.name
        assert occurrence.subtitle == self.handler.construct_title(
            snuba_query=self.snuba_query,
            detector_trigger=self.warning_detector_trigger,
            priority=self.warning_detector_trigger.condition_result,
        )
        assert occurrence.evidence_data == evidence_data
        assert occurrence.level == "error"
        assert occurrence.priority == self.warning_detector_trigger.condition_result

    def test_does_not_trigger(self):
        value = self.warning_detector_trigger.comparison - 1
        packet = QuerySubscriptionUpdate(
            entity="entity",
            subscription_id=str(self.query_subscription.id),
            values={"value": value},
            timestamp=datetime.now(UTC),
        )
        data_packet = DataPacket[QuerySubscriptionUpdate](
            source_id=str(self.query_subscription.id), packet=packet
        )
        result = self.handler.evaluate(data_packet)
        assert result == {}

    def test_missing_detector_trigger(self):
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
        DataCondition.objects.all().delete()
        result = self.handler.evaluate(data_packet)
        assert result == {}


class TestConstructTitle(TestEvaluateMetricDetector):
    def test_title_critical(self):
        title = self.handler.construct_title(
            snuba_query=self.snuba_query,
            detector_trigger=self.critical_detector_trigger,
            priority=self.critical_detector_trigger.condition_result,
        )
        assert (
            title
            == f"Critical: Number of events in the last minute above {self.critical_detector_trigger.comparison}"
        )

    def test_title_warning(self):
        title = self.handler.construct_title(
            snuba_query=self.snuba_query,
            detector_trigger=self.warning_detector_trigger,
            priority=self.warning_detector_trigger.condition_result,
        )
        assert (
            title
            == f"Warning: Number of events in the last minute above {self.warning_detector_trigger.comparison}"
        )

    def test_title_comparison_delta(self):
        self.detector.config.update({"comparison_delta": 60 * 60})

        title = self.handler.construct_title(
            snuba_query=self.snuba_query,
            detector_trigger=self.critical_detector_trigger,
            priority=self.critical_detector_trigger.condition_result,
        )
        assert (
            title
            == "Critical: Number of events in the last minute greater than same time one hour ago"
        )

    def test_title_below_threshold(self):
        self.warning_detector_trigger.type = Condition.LESS
        self.warning_detector_trigger.save()

        title = self.handler.construct_title(
            snuba_query=self.snuba_query,
            detector_trigger=self.warning_detector_trigger,
            priority=self.warning_detector_trigger.condition_result,
        )
        assert (
            title
            == f"Warning: Number of events in the last minute below {self.warning_detector_trigger.comparison}"
        )

    def test_title_different_aggregate(self):
        self.snuba_query.aggregate = "count_unique(tags[sentry:user])"
        title = self.handler.construct_title(
            snuba_query=self.snuba_query,
            detector_trigger=self.critical_detector_trigger,
            priority=self.critical_detector_trigger.condition_result,
        )
        assert (
            title
            == f"Critical: Number of users affected in the last minute above {self.critical_detector_trigger.comparison}"
        )

        self.snuba_query.aggregate = "percentage(sessions_crashed, sessions)"
        title = self.handler.construct_title(
            snuba_query=self.snuba_query,
            detector_trigger=self.critical_detector_trigger,
            priority=self.critical_detector_trigger.condition_result,
        )
        assert (
            title
            == f"Critical: Crash free session rate in the last minute above {self.critical_detector_trigger.comparison}"
        )
