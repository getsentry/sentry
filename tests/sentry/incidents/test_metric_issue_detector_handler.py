from datetime import UTC, datetime

from sentry.constants import CRASH_RATE_ALERT_AGGREGATE_ALIAS
from sentry.incidents.grouptype import (
    MetricIssueDetectorHandler,
    SessionsAggregate,
    get_alert_type_from_aggregate_dataset,
)
from sentry.incidents.utils.types import (
    DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
    AnomalyDetectionUpdate,
)
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.snuba.dataset import Dataset
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.workflow_engine.models import DataCondition, DataPacket
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.processors.data_packet import process_data_packet
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

    def test_evidence_display_observed_value(self) -> None:
        value = self.critical_detector_trigger.comparison + 1
        data_packet = self.create_subscription_packet(value)

        occurrence = self.process_packet_and_return_result(data_packet)
        assert isinstance(occurrence, IssueOccurrence)

        # snuba_query.aggregate is "count()", mapped by QUERY_AGGREGATION_DISPLAY.
        assert len(occurrence.evidence_display) == 1
        evidence = occurrence.evidence_display[0]
        assert evidence.name == "Observed value (Number of events)"
        assert evidence.value == str(value)
        assert evidence.important is True

    def test_evidence_display_has_exactly_one_important_row(self) -> None:
        """Space-constrained integrations surface only the first important row."""
        data_packet = self.create_subscription_packet(self.critical_detector_trigger.comparison + 1)

        occurrence = self.process_packet_and_return_result(data_packet)
        assert isinstance(occurrence, IssueOccurrence)

        assert sum(1 for e in occurrence.evidence_display if e.important) == 1
        assert occurrence.important_evidence_display == occurrence.evidence_display[0]

    def test_evidence_display_comparison_delta(self) -> None:
        self.detector.update(config={"detection_type": "percent", "comparison_delta": 3600})
        value = self.critical_detector_trigger.comparison + 1
        data_packet = self.create_subscription_packet(value)

        occurrence = self.process_packet_and_return_result(data_packet)
        assert isinstance(occurrence, IssueOccurrence)

        assert len(occurrence.evidence_display) == 1
        assert occurrence.evidence_display[0].name == "Observed value (Number of events)"
        assert occurrence.evidence_display[0].value == str(value)

    def test_evidence_display_dynamic_anomaly_packet(self) -> None:
        """The anomaly packet is the reason build_evidence_display reads
        values["value"] directly instead of going through extract_value(), whose
        dynamic branch wraps the result in a group-keyed dict."""
        self.detector.update(config={"detection_type": "dynamic", "comparison_delta": None})
        packet = AnomalyDetectionUpdate(
            entity="entity",
            subscription_id=str(self.query_subscription.id),
            values={
                "value": 42,
                "source_id": str(self.query_subscription.id),
                "subscription_id": str(self.query_subscription.id),
                "timestamp": datetime.now(UTC),
            },
            timestamp=datetime.now(UTC),
        )
        data_packet = DataPacket[AnomalyDetectionUpdate](
            source_id=str(self.query_subscription.id), packet=packet
        )

        evidence_display = self.handler.build_evidence_display(self.snuba_query, data_packet)

        assert len(evidence_display) == 1
        assert evidence_display[0].name == "Observed value (Number of events)"
        assert evidence_display[0].value == "42"
        assert evidence_display[0].important is True

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

    def test_event_data_environment(self) -> None:
        value = self.critical_detector_trigger.comparison + 1
        data_packet = self.create_subscription_packet(value)
        results = process_data_packet(data_packet, DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION)
        evaluation_result = results[0][1][self.detector_group_key]
        assert evaluation_result.data["event_data"] is not None
        assert evaluation_result.data["event_data"]["environment"] == self.environment.name

    def test_event_data_environment_unset(self) -> None:
        self.snuba_query.environment = None
        self.snuba_query.save()
        value = self.critical_detector_trigger.comparison + 1
        data_packet = self.create_subscription_packet(value)
        results = process_data_packet(data_packet, DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION)
        evaluation_result = results[0][1][self.detector_group_key]
        assert evaluation_result.data["event_data"] is not None
        assert evaluation_result.data["event_data"]["environment"] is None

    def test_flipped_detector_trigger(self) -> None:
        self.warning_detector_trigger.delete()
        self.critical_detector_trigger.update(type=Condition.LESS)
        value = self.critical_detector_trigger.comparison - 1
        data_packet = self.create_subscription_packet(value)
        evidence_data = self.generate_evidence_data(value, self.critical_detector_trigger)

        occurrence = self.process_packet_and_return_result(data_packet)
        assert isinstance(occurrence, IssueOccurrence)

        self.verify_issue_occurrence(occurrence, evidence_data, self.critical_detector_trigger)


@freeze_time()
class TestFormatAggregate(BaseMetricIssueTest):
    def setUp(self) -> None:
        super().setUp()
        self.handler = MetricIssueDetectorHandler(self.detector)

    def test_mapped_aggregate(self) -> None:
        self.snuba_query.aggregate = "count()"
        assert self.handler.format_aggregate(self.snuba_query) == (
            "Number of events",
            "count()",
        )

    def test_unmapped_aggregate_falls_back_to_key(self) -> None:
        self.snuba_query.aggregate = "p95(span.duration)"
        assert self.handler.format_aggregate(self.snuba_query) == (
            "p95(span.duration)",
            "p95(span.duration)",
        )

    def test_mri_aggregate(self) -> None:
        self.snuba_query.aggregate = "sum(c:custom/my_metric@none)"
        label, key = self.handler.format_aggregate(self.snuba_query)
        assert label == "sum(my_metric)"
        assert key == "sum(c:custom/my_metric@none)"

    def test_equation_aggregate(self) -> None:
        self.snuba_query.aggregate = "equation|count() * 2"
        assert self.handler.format_aggregate(self.snuba_query) == (
            "count() * 2",
            "equation|count() * 2",
        )

    def test_crash_rate_alias_strips_key(self) -> None:
        """The label and the key diverge here: the alias suffix is stripped off the
        key, and that stripped key is what dynamic alert classification consumes."""
        self.snuba_query.aggregate = (
            f"percentage(sessions_crashed, sessions) AS {CRASH_RATE_ALERT_AGGREGATE_ALIAS}"
        )
        assert self.handler.format_aggregate(self.snuba_query) == (
            "Crash free session rate",
            "percentage(sessions_crashed, sessions)",
        )


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

    def test_title_equation_aggregate(self) -> None:
        self.snuba_query.aggregate = (
            'equation|count_if(`agent_name:"Agent Run"`,value,metric_name,distribution,none) * 2'
        )
        title = self.handler.construct_title(
            snuba_query=self.snuba_query,
            detector_trigger=self.critical_detector_trigger,
            priority=self.critical_detector_trigger.condition_result,
        )
        assert (
            title
            == f'Critical: count_if(`agent_name:"Agent Run"`,value,metric_name,distribution,none) * 2 in the last minute above {self.critical_detector_trigger.comparison}'
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

    def test_dynamic_alert_title_equation(self) -> None:
        self.detector.config.update({"detection_type": "dynamic"})
        self.snuba_query.aggregate = (
            'equation|count_if(`agent_name:"Agent Run"`,value,metric_name,distribution,none) * 2'
        )
        self.snuba_query.dataset = Dataset.EventsAnalyticsPlatform.value
        title = self.handler.construct_title(
            snuba_query=self.snuba_query,
            detector_trigger=self.critical_detector_trigger,
            priority=self.critical_detector_trigger.condition_result,
        )
        assert title == "Detected an anomaly in the query for eap_metrics"


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
        assert (
            get_alert_type_from_aggregate_dataset(
                'equation|count_if(`agent_name:"Agent Run"`,value,metric_name,distribution,none) * 2',
                Dataset.EventsAnalyticsPlatform,
            )
            == "eap_metrics"
        )
