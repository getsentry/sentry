from unittest import mock

import orjson
from urllib3.response import HTTPResponse

from sentry.incidents.grouptype import (
    MetricIssue,
    MetricIssueDetectorHandler,
    SessionsAggregate,
    get_alert_type_from_aggregate_dataset,
)
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.seer.anomaly_detection.types import (
    AnomalyDetectionSeasonality,
    AnomalyDetectionSensitivity,
    AnomalyDetectionThresholdType,
    AnomalyType,
    DetectAnomaliesResponse,
)
from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.workflow_engine.models import DataCondition
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel
from tests.sentry.incidents.utils.test_metric_issue_base import BaseMetricIssueTest


@freeze_time()
class TestEvaluateMetricDetector(BaseMetricIssueTest):
    def setUp(self) -> None:
        super().setUp()
        self.handler = MetricIssueDetectorHandler(self.detector)

    def generate_evidence_data(
        self,
        value: int,
        detector_trigger: DataCondition,
        extra_trigger: DataCondition | None = None,
    ):
        self.query_subscription.refresh_from_db()

        conditions = [
            {
                "id": detector_trigger.id,
                "type": detector_trigger.type,
                "comparison": detector_trigger.comparison,
                "condition_result": detector_trigger.condition_result.value,
            },
        ]

        if extra_trigger:
            conditions.append(
                {
                    "id": extra_trigger.id,
                    "type": extra_trigger.type,
                    "comparison": extra_trigger.comparison,
                    "condition_result": extra_trigger.condition_result.value,
                }
            )

        evidence_data = {
            "detector_id": self.detector.id,
            "value": value,
            "alert_id": self.alert_rule.id,
            "data_packet_source_id": str(self.query_subscription.id),
            "conditions": conditions,
            "config": self.detector.config,
            "data_sources": [
                {
                    "id": str(self.data_source.id),
                    "organization_id": str(self.organization.id),
                    "type": self.data_source.type,
                    "source_id": str(self.query_subscription.id),
                    "query_obj": {
                        "id": str(self.query_subscription.id),
                        "status": self.query_subscription.status,
                        "subscription": self.query_subscription.subscription_id,
                        "snuba_query": {
                            "id": str(self.snuba_query.id),
                            "dataset": self.snuba_query.dataset,
                            "query": self.snuba_query.query,
                            "aggregate": self.snuba_query.aggregate,
                            "time_window": self.snuba_query.time_window,
                            "environment": self.environment.name,
                            "event_types": ["error"],
                            "extrapolation_mode": "unknown",
                        },
                    },
                }
            ],
        }

        return evidence_data

    def verify_issue_occurrence(
        self, occurrence: IssueOccurrence, evidence_data: dict, detector_trigger: DataCondition
    ) -> None:
        assert occurrence is not None
        assert occurrence.issue_title == self.detector.name
        assert occurrence.subtitle == self.handler.construct_title(
            snuba_query=self.snuba_query,
            detector_trigger=detector_trigger,
            priority=detector_trigger.condition_result,
        )
        assert occurrence.evidence_data == evidence_data
        assert occurrence.level == "error"
        assert occurrence.priority == detector_trigger.condition_result
        assert occurrence.assignee
        assert occurrence.assignee.id == self.detector.owner_user_id

    def test_metric_issue_occurrence(self) -> None:
        value = self.critical_detector_trigger.comparison + 1
        data_packet = self.create_subscription_packet(value)
        evidence_data = self.generate_evidence_data(
            value, self.critical_detector_trigger, self.warning_detector_trigger
        )

        occurrence = self.process_packet_and_return_result(data_packet)
        assert isinstance(occurrence, IssueOccurrence)

        self.verify_issue_occurrence(occurrence, evidence_data, self.critical_detector_trigger)

    def test_warning_level(self) -> None:
        value = self.warning_detector_trigger.comparison + 1
        data_packet = self.create_subscription_packet(value)
        evidence_data = self.generate_evidence_data(value, self.warning_detector_trigger)

        occurrence = self.process_packet_and_return_result(data_packet)
        assert isinstance(occurrence, IssueOccurrence)

        self.verify_issue_occurrence(occurrence, evidence_data, self.warning_detector_trigger)

    def test_does_not_trigger(self) -> None:
        value = self.warning_detector_trigger.comparison - 1
        data_packet = self.create_subscription_packet(value)
        result = self.process_packet_and_return_result(data_packet)
        assert result is None

    def test_missing_detector_trigger(self) -> None:
        value = self.critical_detector_trigger.comparison + 1
        data_packet = self.create_subscription_packet(value)
        DataCondition.objects.all().delete()
        result = self.process_packet_and_return_result(data_packet)
        assert result is None

    def test_flipped_detector_trigger(self) -> None:
        self.warning_detector_trigger.delete()
        self.critical_detector_trigger.update(type=Condition.LESS)
        value = self.critical_detector_trigger.comparison - 1
        data_packet = self.create_subscription_packet(value)
        evidence_data = self.generate_evidence_data(value, self.critical_detector_trigger)

        occurrence = self.process_packet_and_return_result(data_packet)
        assert isinstance(occurrence, IssueOccurrence)

        self.verify_issue_occurrence(occurrence, evidence_data, self.critical_detector_trigger)

    @mock.patch(
        "sentry.seer.anomaly_detection.get_anomaly_data.SEER_ANOMALY_DETECTION_CONNECTION_POOL.urlopen"
    )
    def test_anomaly_detection_evidence_extracts_value(
        self, mock_seer_request: mock.MagicMock
    ) -> None:
        """
        When the data packet is an AnomalyDetectionUpdate, the evidence data
        should contain the numeric value extracted from the anomaly dict,
        not the entire dict.
        """
        self.detector = self.create_detector(
            project=self.project,
            workflow_condition_group=self.create_data_condition_group(),
            type=MetricIssue.slug,
            created_by_id=self.user.id,
            owner_user_id=self.user.id,
            config={"threshold_period": 1, "detection_type": "dynamic"},
        )
        anomaly_condition = self.create_data_condition(
            type=Condition.ANOMALY_DETECTION,
            comparison={
                "sensitivity": AnomalyDetectionSensitivity.MEDIUM.value,
                "seasonality": AnomalyDetectionSeasonality.AUTO.value,
                "threshold_type": AnomalyDetectionThresholdType.ABOVE_AND_BELOW.value,
            },
            condition_result=DetectorPriorityLevel.HIGH,
            condition_group=self.detector.workflow_condition_group,
        )
        self.create_data_source_detector(self.data_source, self.detector)
        self.alert_rule = self.create_alert_rule()
        self.create_alert_rule_detector(alert_rule_id=self.alert_rule.id, detector=self.detector)
        self.handler = MetricIssueDetectorHandler(self.detector)

        value = 8938
        data_packet = self.create_anomaly_detection_packet(value)

        seer_response: DetectAnomaliesResponse = {
            "success": True,
            "timeseries": [
                {
                    "anomaly": {
                        "anomaly_score": 0.9,
                        "anomaly_type": AnomalyType.HIGH_CONFIDENCE,
                    },
                    "timestamp": 1,
                    "value": value,
                }
            ],
        }
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_response), status=200)

        evidence_data = self.generate_evidence_data(value, anomaly_condition)
        occurrence = self.process_packet_and_return_result(data_packet)
        assert isinstance(occurrence, IssueOccurrence)

        self.verify_issue_occurrence(occurrence, evidence_data, anomaly_condition)


class TestConstructTitle(TestEvaluateMetricDetector):
    def test_title_critical(self) -> None:
        title = self.handler.construct_title(
            snuba_query=self.snuba_query,
            detector_trigger=self.critical_detector_trigger,
            priority=self.critical_detector_trigger.condition_result,
        )
        assert (
            title
            == f"Critical: Number of events in the last minute above {self.critical_detector_trigger.comparison}"
        )

    def test_title_warning(self) -> None:
        title = self.handler.construct_title(
            snuba_query=self.snuba_query,
            detector_trigger=self.warning_detector_trigger,
            priority=self.warning_detector_trigger.condition_result,
        )
        assert (
            title
            == f"Warning: Number of events in the last minute above {self.warning_detector_trigger.comparison}"
        )

    def test_title_comparison_delta(self) -> None:
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

    def test_title_below_threshold(self) -> None:
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

    def test_title_different_aggregate(self) -> None:
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

    def test_dynamic_alert_title(self) -> None:
        self.detector.config.update({"detection_type": "dynamic"})
        self.snuba_query.aggregate = "count_unique(user)"
        title = self.handler.construct_title(
            snuba_query=self.snuba_query,
            detector_trigger=self.critical_detector_trigger,
            priority=self.critical_detector_trigger.condition_result,
        )
        assert title == "Detected an anomaly in the query for users_experiencing_errors"

        self.snuba_query.aggregate = "p95(transaction.duration)"
        title = self.handler.construct_title(
            snuba_query=self.snuba_query,
            detector_trigger=self.critical_detector_trigger,
            priority=self.critical_detector_trigger.condition_result,
        )
        assert title == "Detected an anomaly in the query for custom_transactions"

    def test_dynamic_alert_title_default(self) -> None:
        self.detector.config.update({"detection_type": "dynamic"})
        self.snuba_query.dataset = "asdf"
        self.snuba_query.aggregate = "default_aggregate"
        title = self.handler.construct_title(
            snuba_query=self.snuba_query,
            detector_trigger=self.critical_detector_trigger,
            priority=self.critical_detector_trigger.condition_result,
        )
        assert title == "Detected an anomaly in the query for default_aggregate"


class TestGetAnomalyDetectionIssueTitle(TestCase):
    def test_extract_lcp_alert(self) -> None:
        assert (
            get_alert_type_from_aggregate_dataset("p95(measurements.lcp)", Dataset.Transactions)
            == "lcp"
        )
        assert (
            get_alert_type_from_aggregate_dataset(
                "percentile(measurements.lcp,0.7)", Dataset.Transactions
            )
            == "lcp"
        )
        assert (
            get_alert_type_from_aggregate_dataset("avg(measurements.lcp)", Dataset.Transactions)
            == "lcp"
        )

    def test_extract_duration_alert(self) -> None:
        assert (
            get_alert_type_from_aggregate_dataset("p95(transaction.duration)", Dataset.Transactions)
            == "trans_duration"
        )
        assert (
            get_alert_type_from_aggregate_dataset(
                "percentile(transaction.duration,0.3)", Dataset.Transactions
            )
            == "trans_duration"
        )
        assert (
            get_alert_type_from_aggregate_dataset("avg(transaction.duration)", Dataset.Transactions)
            == "trans_duration"
        )

    def test_extract_throughput_alert(self) -> None:
        assert (
            get_alert_type_from_aggregate_dataset("count()", Dataset.Transactions) == "throughput"
        )

    def test_extract_user_error_alert(self) -> None:
        assert (
            get_alert_type_from_aggregate_dataset("count_unique(user)", Dataset.Events)
            == "users_experiencing_errors"
        )

    def test_extract_error_count_alert(self) -> None:
        assert get_alert_type_from_aggregate_dataset("count()", Dataset.Events) == "num_errors"

    def test_extract_crash_free_sessions_alert(self) -> None:
        assert (
            get_alert_type_from_aggregate_dataset(
                SessionsAggregate.CRASH_FREE_SESSIONS, Dataset.Metrics
            )
            == "crash_free_sessions"
        )

    def test_extract_crash_free_users_alert(self) -> None:
        assert (
            get_alert_type_from_aggregate_dataset(
                SessionsAggregate.CRASH_FREE_USERS, Dataset.Metrics
            )
            == "crash_free_users"
        )

    def test_defaults_to_custom(self) -> None:
        assert (
            get_alert_type_from_aggregate_dataset(
                "count_unique(tags[sentry:user])", Dataset.Transactions
            )
            == "custom_transactions"
        )
        assert (
            get_alert_type_from_aggregate_dataset("p95(measurements.fp)", Dataset.Transactions)
            == "custom_transactions"
        )
        assert (
            get_alert_type_from_aggregate_dataset("p95(measurements.ttfb)", Dataset.Transactions)
            == "custom_transactions"
        )
        assert (
            get_alert_type_from_aggregate_dataset(
                "count(d:transaction/measurement@seconds)", Dataset.PerformanceMetrics
            )
            == "custom_transactions"
        )

    def test_extract_eap_metrics_alert(self) -> None:
        assert (
            get_alert_type_from_aggregate_dataset(
                "count(span.duration)", Dataset.EventsAnalyticsPlatform
            )
            == "eap_metrics"
        )

    def test_extract_eap_metrics_alert_trace_metrics(self) -> None:
        assert (
            get_alert_type_from_aggregate_dataset(
                "per_second(value,metric_name_one,counter,-)", Dataset.EventsAnalyticsPlatform
            )
            == "eap_metrics"
        )
        assert (
            get_alert_type_from_aggregate_dataset(
                "count(metric.name,metric_name_two,distribution,-)",
                Dataset.EventsAnalyticsPlatform,
            )
            == "eap_metrics"
        )
