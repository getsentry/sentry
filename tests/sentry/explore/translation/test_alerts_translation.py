from datetime import timedelta
from unittest.mock import patch

import orjson
import pytest
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    ExtrapolationMode as RPCExtrapolationMode,
)
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import Function
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter
from urllib3.response import HTTPResponse

from sentry.explore.translation.alerts_translation import (
    rollback_detector_query_and_update_subscription_in_snuba,
    snapshot_snuba_query,
    translate_detector_and_update_subscription_in_snuba,
)
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.seer.anomaly_detection.store_data import SeerMethod
from sentry.seer.anomaly_detection.types import (
    AnomalyDetectionSeasonality,
    AnomalyDetectionSensitivity,
    AnomalyDetectionThresholdType,
    StoreDataResponse,
)
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import (
    ExtrapolationMode,
    QuerySubscription,
    SnubaQuery,
    SnubaQueryEventType,
)
from sentry.snuba.subscriptions import create_snuba_query
from sentry.snuba.tasks import SubscriptionError
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.workflow_engine.types import DetectorPriorityLevel

pytestmark = pytest.mark.sentry_metrics


class AlertsTranslationTestCase(TestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.org = self.create_organization()
        self.project = self.create_project(organization=self.org)

    def test_snapshot_snuba_query_with_performance_metrics(self) -> None:

        snuba_query = create_snuba_query(
            query_type=SnubaQuery.Type.PERFORMANCE,
            dataset=Dataset.PerformanceMetrics,
            query="transaction.duration:>100",
            aggregate="count()",
            time_window=timedelta(minutes=10),
            environment=None,
            event_types=[SnubaQueryEventType.EventType.TRANSACTION],
            resolution=timedelta(minutes=1),
        )

        snapshot_snuba_query(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.query_snapshot is not None
        assert snuba_query.query_snapshot["type"] == snuba_query.type
        assert snuba_query.query_snapshot["dataset"] == Dataset.PerformanceMetrics.value
        assert snuba_query.query_snapshot["query"] == "transaction.duration:>100"
        assert snuba_query.query_snapshot["aggregate"] == "count()"
        assert snuba_query.query_snapshot["time_window"] == snuba_query.time_window

    def test_snapshot_snuba_query_with_transactions(self) -> None:
        snuba_query = create_snuba_query(
            query_type=SnubaQuery.Type.PERFORMANCE,
            dataset=Dataset.Transactions,
            query="transaction.duration:>100",
            aggregate="p95(transaction.duration)",
            time_window=timedelta(minutes=10),
            environment=None,
            event_types=[SnubaQueryEventType.EventType.TRANSACTION],
            resolution=timedelta(minutes=1),
        )

        snapshot_snuba_query(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.query_snapshot is not None
        assert snuba_query.query_snapshot["type"] == snuba_query.type
        assert snuba_query.query_snapshot["dataset"] == Dataset.Transactions.value
        assert snuba_query.query_snapshot["query"] == "transaction.duration:>100"
        assert snuba_query.query_snapshot["aggregate"] == "p95(transaction.duration)"
        assert snuba_query.query_snapshot["time_window"] == snuba_query.time_window

    def test_snapshot_snuba_query_with_events_dataset(self) -> None:
        snuba_query = create_snuba_query(
            query_type=SnubaQuery.Type.PERFORMANCE,
            dataset=Dataset.Events,
            query="transaction.duration:>100",
            aggregate="p95(transaction.duration)",
            time_window=timedelta(minutes=10),
            environment=None,
            event_types=[SnubaQueryEventType.EventType.DEFAULT],
            resolution=timedelta(minutes=1),
        )

        assert snuba_query.query_snapshot is None

        snapshot_snuba_query(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.query_snapshot is None

    @with_feature("organizations:migrate-transaction-alerts-to-spans")
    @patch("sentry.snuba.tasks._create_rpc_in_snuba")
    def test_translate_alert_rule_simple_count(self, mock_create_rpc) -> None:
        mock_create_rpc.return_value = "test-subscription-id"

        snuba_query = create_snuba_query(
            query_type=SnubaQuery.Type.PERFORMANCE,
            dataset=Dataset.PerformanceMetrics,
            query="transaction.duration:>100",
            aggregate="count()",
            time_window=timedelta(minutes=10),
            environment=None,
            event_types=[SnubaQueryEventType.EventType.TRANSACTION],
            resolution=timedelta(minutes=1),
        )
        original_dataset = snuba_query.dataset

        query_subscription = QuerySubscription.objects.create(
            project=self.project,
            type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
            snuba_query=snuba_query,
            status=QuerySubscription.Status.ACTIVE.value,
        )

        data_source = self.create_data_source(
            organization=self.org,
            source_id=str(query_subscription.id),
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )

        detector_data_condition_group = self.create_data_condition_group(
            organization=self.org,
        )

        detector = self.create_detector(
            name="Test Detector",
            type=MetricIssue.slug,
            project=self.project,
            config={"detection_type": AlertRuleDetectionType.STATIC.value},
            workflow_condition_group=detector_data_condition_group,
        )

        data_source.detectors.add(detector)

        assert snuba_query.dataset == Dataset.PerformanceMetrics.value

        # Now translate and update the subscription with tasks enabled
        with self.tasks():
            translate_detector_and_update_subscription_in_snuba(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.query_snapshot is not None
        assert snuba_query.query_snapshot["dataset"] == original_dataset

        assert snuba_query.dataset == Dataset.EventsAnalyticsPlatform.value
        assert snuba_query.aggregate == "count(span.duration)"
        assert snuba_query.query == "(span.duration:>100) AND is_transaction:1"
        assert snuba_query.extrapolation_mode == ExtrapolationMode.SERVER_WEIGHTED.value

        event_types = list(
            SnubaQueryEventType.objects.filter(snuba_query=snuba_query).values_list(
                "type", flat=True
            )
        )
        assert len(event_types) == 1
        assert event_types[0] == SnubaQueryEventType.EventType.TRACE_ITEM_SPAN.value

        assert mock_create_rpc.called
        assert mock_create_rpc.call_count == 1

        call_args = mock_create_rpc.call_args
        rpc_time_series_request = call_args[0][2]

        assert rpc_time_series_request is not None

        assert rpc_time_series_request.meta.organization_id == self.org.id
        assert rpc_time_series_request.meta.referrer == "api.alerts.alert-rule-chart"
        assert self.project.id in rpc_time_series_request.meta.project_ids
        assert rpc_time_series_request.meta.trace_item_type == TraceItemType.TRACE_ITEM_TYPE_SPAN

        and_filter = rpc_time_series_request.filter.and_filter
        filter_1 = and_filter.filters[0].comparison_filter
        assert filter_1.key.name == "sentry.duration_ms"
        assert filter_1.op == ComparisonFilter.OP_GREATER_THAN
        assert filter_1.value.val_double == 100.0

        filter_2 = and_filter.filters[1].comparison_filter
        assert filter_2.key.name == "sentry.is_segment"
        assert filter_2.op == ComparisonFilter.OP_EQUALS
        assert filter_2.value.val_bool is True

        assert rpc_time_series_request.granularity_secs == 600

        assert len(rpc_time_series_request.expressions) == 1
        expression = rpc_time_series_request.expressions[0]
        assert expression.HasField("aggregation")
        assert expression.aggregation.aggregate == Function.FUNCTION_COUNT
        assert expression.aggregation.key.name == "sentry.project_id"
        assert expression.aggregation.label == "count(span.duration)"
        assert expression.label == "count(span.duration)"
        assert (
            expression.aggregation.extrapolation_mode
            == RPCExtrapolationMode.EXTRAPOLATION_MODE_SERVER_ONLY
        )

        assert len(rpc_time_series_request.group_by) == 0

    @with_feature("organizations:migrate-transaction-alerts-to-spans")
    @patch("sentry.snuba.tasks._create_rpc_in_snuba")
    def test_translate_alert_rule_p95(self, mock_create_rpc) -> None:
        mock_create_rpc.return_value = "test-subscription-id"

        snuba_query = create_snuba_query(
            query_type=SnubaQuery.Type.PERFORMANCE,
            dataset=Dataset.Transactions,
            query="http.method:GET",
            aggregate="p95(transaction.duration)",
            time_window=timedelta(minutes=10),
            environment=None,
            event_types=[SnubaQueryEventType.EventType.TRANSACTION],
            resolution=timedelta(minutes=1),
        )

        query_subscription = QuerySubscription.objects.create(
            project=self.project,
            type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
            snuba_query=snuba_query,
            status=QuerySubscription.Status.ACTIVE.value,
        )

        data_source = self.create_data_source(
            organization=self.org,
            source_id=str(query_subscription.id),
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )

        detector_data_condition_group = self.create_data_condition_group(
            organization=self.org,
        )

        detector = self.create_detector(
            name="Test Detector",
            type=MetricIssue.slug,
            project=self.project,
            config={"detection_type": AlertRuleDetectionType.STATIC.value},
            workflow_condition_group=detector_data_condition_group,
        )

        data_source.detectors.add(detector)

        assert snuba_query.dataset == Dataset.Transactions.value

        with self.tasks():
            translate_detector_and_update_subscription_in_snuba(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.dataset == Dataset.EventsAnalyticsPlatform.value
        assert snuba_query.aggregate == "p95(span.duration)"
        assert snuba_query.query == "(transaction.method:GET) AND is_transaction:1"
        assert snuba_query.extrapolation_mode == ExtrapolationMode.CLIENT_AND_SERVER_WEIGHTED.value

        event_types = list(
            SnubaQueryEventType.objects.filter(snuba_query=snuba_query).values_list(
                "type", flat=True
            )
        )
        assert len(event_types) == 1
        assert event_types[0] == SnubaQueryEventType.EventType.TRACE_ITEM_SPAN.value

        assert mock_create_rpc.called
        call_args = mock_create_rpc.call_args
        rpc_time_series_request = call_args[0][2]

        assert rpc_time_series_request is not None
        assert len(rpc_time_series_request.expressions) > 0

    @with_feature("organizations:migrate-transaction-alerts-to-spans")
    @patch("sentry.snuba.tasks._create_rpc_in_snuba")
    def test_translate_alert_rule_count_unique(self, mock_create_rpc) -> None:
        mock_create_rpc.return_value = "test-subscription-id"

        snuba_query = create_snuba_query(
            query_type=SnubaQuery.Type.PERFORMANCE,
            dataset=Dataset.PerformanceMetrics,
            query="transaction:/api/*",
            aggregate="count_unique(user)",
            time_window=timedelta(minutes=10),
            environment=None,
            event_types=[SnubaQueryEventType.EventType.TRANSACTION],
            resolution=timedelta(minutes=1),
        )

        query_subscription = QuerySubscription.objects.create(
            project=self.project,
            type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
            snuba_query=snuba_query,
            status=QuerySubscription.Status.ACTIVE.value,
        )

        data_source = self.create_data_source(
            organization=self.org,
            source_id=str(query_subscription.id),
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )

        detector_data_condition_group = self.create_data_condition_group(
            organization=self.org,
        )

        detector = self.create_detector(
            name="Test Detector",
            type=MetricIssue.slug,
            project=self.project,
            config={"detection_type": AlertRuleDetectionType.STATIC.value},
            workflow_condition_group=detector_data_condition_group,
        )

        data_source.detectors.add(detector)

        with self.tasks():
            translate_detector_and_update_subscription_in_snuba(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.dataset == Dataset.EventsAnalyticsPlatform.value
        assert snuba_query.aggregate == "count_unique(user)"
        assert snuba_query.query == "(transaction:/api/*) AND is_transaction:1"
        assert snuba_query.extrapolation_mode == ExtrapolationMode.SERVER_WEIGHTED.value

        assert mock_create_rpc.called
        call_args = mock_create_rpc.call_args
        rpc_time_series_request = call_args[0][2]
        assert rpc_time_series_request is not None
        assert len(rpc_time_series_request.expressions) > 0

    @with_feature("organizations:migrate-transaction-alerts-to-spans")
    @patch("sentry.snuba.tasks._create_rpc_in_snuba")
    def test_translate_alert_rule_apdex(self, mock_create_rpc) -> None:
        mock_create_rpc.return_value = "test-subscription-id"

        snuba_query = create_snuba_query(
            query_type=SnubaQuery.Type.PERFORMANCE,
            dataset=Dataset.Transactions,
            query="",
            aggregate="apdex(300)",
            time_window=timedelta(minutes=10),
            environment=None,
            event_types=[SnubaQueryEventType.EventType.TRANSACTION],
            resolution=timedelta(minutes=1),
        )

        query_subscription = QuerySubscription.objects.create(
            project=self.project,
            type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
            snuba_query=snuba_query,
            status=QuerySubscription.Status.ACTIVE.value,
        )

        data_source = self.create_data_source(
            organization=self.org,
            source_id=str(query_subscription.id),
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )

        detector_data_condition_group = self.create_data_condition_group(
            organization=self.org,
        )

        detector = self.create_detector(
            name="Test Detector",
            type=MetricIssue.slug,
            project=self.project,
            config={"detection_type": AlertRuleDetectionType.STATIC.value},
            workflow_condition_group=detector_data_condition_group,
        )

        data_source.detectors.add(detector)

        with self.tasks():
            translate_detector_and_update_subscription_in_snuba(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.dataset == Dataset.EventsAnalyticsPlatform.value
        assert snuba_query.aggregate == "apdex(span.duration,300)"
        assert snuba_query.query == "is_transaction:1"
        assert snuba_query.extrapolation_mode == ExtrapolationMode.CLIENT_AND_SERVER_WEIGHTED.value

        assert mock_create_rpc.called
        call_args = mock_create_rpc.call_args
        rpc_time_series_request = call_args[0][2]
        assert rpc_time_series_request is not None
        assert len(rpc_time_series_request.expressions) > 0

    @with_feature("organizations:migrate-transaction-alerts-to-spans")
    @patch("sentry.snuba.tasks._create_rpc_in_snuba")
    def test_translate_alert_rule_empty_query(self, mock_create_rpc) -> None:
        mock_create_rpc.return_value = "test-subscription-id"

        snuba_query = create_snuba_query(
            query_type=SnubaQuery.Type.PERFORMANCE,
            dataset=Dataset.Transactions,
            query="",
            aggregate="count()",
            time_window=timedelta(minutes=10),
            environment=None,
            event_types=[SnubaQueryEventType.EventType.TRANSACTION],
            resolution=timedelta(minutes=1),
        )

        query_subscription = QuerySubscription.objects.create(
            project=self.project,
            type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
            snuba_query=snuba_query,
            status=QuerySubscription.Status.ACTIVE.value,
        )

        data_source = self.create_data_source(
            organization=self.org,
            source_id=str(query_subscription.id),
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )

        detector_data_condition_group = self.create_data_condition_group(
            organization=self.org,
        )

        detector = self.create_detector(
            name="Test Detector",
            type=MetricIssue.slug,
            project=self.project,
            config={"detection_type": AlertRuleDetectionType.STATIC.value},
            workflow_condition_group=detector_data_condition_group,
        )

        data_source.detectors.add(detector)

        with self.tasks():
            translate_detector_and_update_subscription_in_snuba(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.dataset == Dataset.EventsAnalyticsPlatform.value
        assert snuba_query.aggregate == "count(span.duration)"
        assert snuba_query.query == "is_transaction:1"
        assert snuba_query.extrapolation_mode == ExtrapolationMode.NONE.value

        assert mock_create_rpc.called
        call_args = mock_create_rpc.call_args
        rpc_time_series_request = call_args[0][2]
        assert rpc_time_series_request is not None
        assert len(rpc_time_series_request.expressions) > 0

    @with_feature("organizations:migrate-transaction-alerts-to-spans")
    @patch("sentry.snuba.tasks._delete_from_snuba")
    @patch("sentry.snuba.tasks._create_snql_in_snuba")
    @patch("sentry.snuba.tasks._create_rpc_in_snuba")
    def test_rollback_alert_rule_query(
        self, mock_create_rpc, mock_create_snql, mock_delete
    ) -> None:
        mock_create_rpc.return_value = "test-subscription-id"
        mock_create_snql.return_value = "rollback-subscription-id"
        mock_delete.return_value = None

        snuba_query = create_snuba_query(
            query_type=SnubaQuery.Type.PERFORMANCE,
            dataset=Dataset.Transactions,
            query="transaction.duration:>100",
            aggregate="count()",
            time_window=timedelta(minutes=10),
            environment=None,
            event_types=[SnubaQueryEventType.EventType.TRANSACTION],
            resolution=timedelta(minutes=1),
        )

        query_subscription = QuerySubscription.objects.create(
            project=self.project,
            type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
            snuba_query=snuba_query,
            status=QuerySubscription.Status.ACTIVE.value,
        )

        data_source = self.create_data_source(
            organization=self.org,
            source_id=str(query_subscription.id),
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )

        detector_data_condition_group = self.create_data_condition_group(
            organization=self.org,
        )

        detector = self.create_detector(
            name="Test Detector",
            type=MetricIssue.slug,
            project=self.project,
            config={"detection_type": AlertRuleDetectionType.STATIC.value},
            workflow_condition_group=detector_data_condition_group,
        )

        data_source.detectors.add(detector)

        original_type = snuba_query.type
        original_dataset = snuba_query.dataset
        original_query = snuba_query.query
        original_aggregate = snuba_query.aggregate
        original_time_window = snuba_query.time_window

        with self.tasks():
            translate_detector_and_update_subscription_in_snuba(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.dataset == Dataset.EventsAnalyticsPlatform.value

        assert mock_create_rpc.called
        assert mock_create_rpc.call_count == 1

        with self.tasks():
            rollback_detector_query_and_update_subscription_in_snuba(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.type == original_type
        assert snuba_query.dataset == original_dataset
        assert snuba_query.query == original_query
        assert snuba_query.aggregate == original_aggregate
        assert snuba_query.time_window == original_time_window

        event_types = list(
            SnubaQueryEventType.objects.filter(snuba_query=snuba_query).values_list(
                "type", flat=True
            )
        )
        assert len(event_types) == 1
        assert event_types[0] == SnubaQueryEventType.EventType.TRANSACTION.value

        assert mock_create_snql.called
        assert mock_create_snql.call_count == 1

        call_args = mock_create_snql.call_args
        snuba_query_arg = call_args[0][1]
        snql_query = call_args[0][2]

        assert snuba_query_arg.dataset == Dataset.Transactions.value
        assert snuba_query_arg.aggregate == "count()"
        assert snuba_query_arg.query == "transaction.duration:>100"

        assert snql_query is not None
        assert snql_query.query is not None
        snql_query_str = str(snql_query.query)
        assert "MATCH (transactions)" in snql_query_str

    @with_feature("organizations:migrate-transaction-alerts-to-spans")
    def test_rollback_without_snapshot(self) -> None:
        snuba_query = create_snuba_query(
            query_type=SnubaQuery.Type.PERFORMANCE,
            dataset=Dataset.Events,
            query="transaction.duration:>100",
            aggregate="count()",
            time_window=timedelta(minutes=10),
            environment=None,
            event_types=[SnubaQueryEventType.EventType.TRANSACTION],
            resolution=timedelta(minutes=1),
        )

        query_subscription = QuerySubscription.objects.create(
            project=self.project,
            type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
            snuba_query=snuba_query,
            status=QuerySubscription.Status.ACTIVE.value,
        )

        data_source = self.create_data_source(
            organization=self.org,
            source_id=str(query_subscription.id),
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )

        detector_data_condition_group = self.create_data_condition_group(
            organization=self.org,
        )

        detector = self.create_detector(
            name="Test Detector",
            type=MetricIssue.slug,
            project=self.project,
            config={"detection_type": AlertRuleDetectionType.STATIC.value},
            workflow_condition_group=detector_data_condition_group,
        )

        data_source.detectors.add(detector)

        original_dataset = snuba_query.dataset

        rollback_detector_query_and_update_subscription_in_snuba(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.dataset == original_dataset
        assert snuba_query.query_snapshot is None

    @with_feature("organizations:migrate-transaction-alerts-to-spans")
    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:incidents")
    @patch("sentry.snuba.tasks._create_rpc_in_snuba")
    @patch("sentry.explore.translation.alerts_translation.handle_send_historical_data_to_seer")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_translate_anomaly_detection_alert(
        self, mock_seer_request, mock_seer, mock_create_rpc
    ) -> None:
        from sentry.workflow_engine.models.data_condition import Condition

        mock_create_rpc.return_value = "test-subscription-id"
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        snuba_query = create_snuba_query(
            query_type=SnubaQuery.Type.PERFORMANCE,
            dataset=Dataset.PerformanceMetrics,
            query="transaction.duration:>100",
            aggregate="count()",
            time_window=timedelta(minutes=10),
            environment=None,
            event_types=[SnubaQueryEventType.EventType.TRANSACTION],
            resolution=timedelta(minutes=1),
        )

        query_subscription = QuerySubscription.objects.create(
            project=self.project,
            type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
            snuba_query=snuba_query,
            status=QuerySubscription.Status.ACTIVE.value,
        )

        data_source = self.create_data_source(
            organization=self.org,
            source_id=str(query_subscription.id),
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )

        detector_data_condition_group = self.create_data_condition_group(
            organization=self.org,
        )

        self.create_data_condition(
            condition_group=detector_data_condition_group,
            type=Condition.ANOMALY_DETECTION,
            comparison={
                "sensitivity": AnomalyDetectionSensitivity.HIGH,
                "seasonality": AnomalyDetectionSeasonality.AUTO,
                "threshold_type": AnomalyDetectionThresholdType.ABOVE,
            },
            condition_result=DetectorPriorityLevel.HIGH,
        )

        detector = self.create_detector(
            name="Test Detector",
            type=MetricIssue.slug,
            project=self.project,
            config={
                "detection_type": AlertRuleDetectionType.DYNAMIC.value,
                "sensitivity": AnomalyDetectionSensitivity.HIGH,
                "seasonality": AnomalyDetectionSeasonality.AUTO,
                "threshold_type": AnomalyDetectionThresholdType.ABOVE,
            },
            workflow_condition_group=detector_data_condition_group,
        )

        data_source.detectors.set([detector])

        translate_detector_and_update_subscription_in_snuba(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.dataset == Dataset.EventsAnalyticsPlatform.value
        assert snuba_query.aggregate == "count(span.duration)"

        assert mock_seer.called
        assert mock_seer.call_count == 1

        call_args = mock_seer.call_args
        detector_arg = call_args[0][0]
        data_source_arg = call_args[0][1]
        data_condition_arg = call_args[0][2]
        snuba_query_arg = call_args[0][3]
        project_arg = call_args[0][4]
        seer_method_arg = call_args[0][5]
        event_types_arg = call_args[1]["event_types"]

        assert detector_arg.id == detector.id
        assert data_source_arg.id == data_source.id
        assert data_condition_arg is not None
        assert snuba_query_arg.id == snuba_query.id
        assert snuba_query_arg.dataset == Dataset.EventsAnalyticsPlatform.value
        assert project_arg.id == self.project.id
        assert seer_method_arg == SeerMethod.UPDATE
        assert event_types_arg == [SnubaQueryEventType.EventType.TRACE_ITEM_SPAN]

    @with_feature("organizations:migrate-transaction-alerts-to-spans")
    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:incidents")
    @patch("sentry.snuba.tasks._delete_from_snuba")
    @patch("sentry.snuba.tasks._create_snql_in_snuba")
    @patch("sentry.snuba.tasks._create_rpc_in_snuba")
    @patch("sentry.explore.translation.alerts_translation.handle_send_historical_data_to_seer")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_rollback_anomaly_detection_alert(
        self,
        mock_seer_request,
        mock_seer,
        mock_create_rpc,
        mock_create_snql,
        mock_delete,
    ) -> None:
        from sentry.workflow_engine.models.data_condition import Condition

        mock_create_rpc.return_value = "test-subscription-id"
        mock_create_snql.return_value = "rollback-subscription-id"
        mock_delete.return_value = None
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        snuba_query = create_snuba_query(
            query_type=SnubaQuery.Type.PERFORMANCE,
            dataset=Dataset.Transactions,
            query="transaction.duration:>100",
            aggregate="count()",
            time_window=timedelta(minutes=10),
            environment=None,
            event_types=[SnubaQueryEventType.EventType.TRANSACTION],
            resolution=timedelta(minutes=1),
        )
        query_subscription = QuerySubscription.objects.create(
            project=self.project,
            type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
            snuba_query=snuba_query,
            status=QuerySubscription.Status.ACTIVE.value,
        )

        data_source = self.create_data_source(
            organization=self.org,
            source_id=str(query_subscription.id),
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )

        detector_data_condition_group = self.create_data_condition_group(
            organization=self.org,
        )

        self.create_data_condition(
            condition_group=detector_data_condition_group,
            type=Condition.ANOMALY_DETECTION,
            comparison={
                "sensitivity": AnomalyDetectionSensitivity.HIGH,
                "seasonality": AnomalyDetectionSeasonality.AUTO,
                "threshold_type": AnomalyDetectionThresholdType.ABOVE,
            },
            condition_result=DetectorPriorityLevel.HIGH,
        )

        detector = self.create_detector(
            name="Test Detector",
            type=MetricIssue.slug,
            project=self.project,
            config={
                "detection_type": AlertRuleDetectionType.DYNAMIC.value,
                "sensitivity": AnomalyDetectionSensitivity.HIGH,
                "seasonality": AnomalyDetectionSeasonality.AUTO,
                "threshold_type": AnomalyDetectionThresholdType.ABOVE,
            },
            workflow_condition_group=detector_data_condition_group,
        )

        data_source.detectors.set([detector])

        original_dataset = snuba_query.dataset

        translate_detector_and_update_subscription_in_snuba(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.dataset == Dataset.EventsAnalyticsPlatform.value
        assert mock_seer.call_count == 1

        rollback_detector_query_and_update_subscription_in_snuba(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.dataset == original_dataset
        assert mock_seer.call_count == 2

        rollback_call_args = mock_seer.call_args_list[1]
        detector_arg = rollback_call_args[0][0]
        data_source_arg = rollback_call_args[0][1]
        data_condition_arg = rollback_call_args[0][2]
        snuba_query_arg = rollback_call_args[0][3]
        project_arg = rollback_call_args[0][4]
        seer_method_arg = rollback_call_args[0][5]
        event_types_arg = rollback_call_args[1]["event_types"]

        assert detector_arg.id == detector.id
        assert data_source_arg.id == data_source.id
        assert data_condition_arg is not None
        assert snuba_query_arg.id == snuba_query.id
        assert snuba_query_arg.dataset == Dataset.Transactions.value
        assert project_arg.id == self.project.id
        assert seer_method_arg == SeerMethod.UPDATE
        assert event_types_arg == [SnubaQueryEventType.EventType.TRANSACTION]

    @with_feature("organizations:migrate-transaction-alerts-to-spans")
    @patch("sentry.snuba.tasks._create_rpc_in_snuba")
    def test_extrapolation_mode_sum_performance_metrics(self, mock_create_rpc) -> None:
        mock_create_rpc.return_value = "test-subscription-id"

        snuba_query = create_snuba_query(
            query_type=SnubaQuery.Type.PERFORMANCE,
            dataset=Dataset.PerformanceMetrics,
            query="",
            aggregate="sum(transaction.duration)",
            time_window=timedelta(minutes=10),
            environment=None,
            event_types=[SnubaQueryEventType.EventType.TRANSACTION],
            resolution=timedelta(minutes=1),
        )

        query_subscription = QuerySubscription.objects.create(
            project=self.project,
            type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
            snuba_query=snuba_query,
            status=QuerySubscription.Status.ACTIVE.value,
        )

        data_source = self.create_data_source(
            organization=self.org,
            source_id=str(query_subscription.id),
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )

        detector_data_condition_group = self.create_data_condition_group(
            organization=self.org,
        )

        detector = self.create_detector(
            name="Test Detector",
            type=MetricIssue.slug,
            project=self.project,
            config={"detection_type": AlertRuleDetectionType.STATIC.value},
            workflow_condition_group=detector_data_condition_group,
        )

        data_source.detectors.add(detector)

        with self.tasks():
            translate_detector_and_update_subscription_in_snuba(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.extrapolation_mode == ExtrapolationMode.SERVER_WEIGHTED.value

    @with_feature("organizations:migrate-transaction-alerts-to-spans")
    @patch("sentry.snuba.tasks._create_rpc_in_snuba")
    def test_extrapolation_mode_sum_transactions(self, mock_create_rpc) -> None:
        mock_create_rpc.return_value = "test-subscription-id"

        snuba_query = create_snuba_query(
            query_type=SnubaQuery.Type.PERFORMANCE,
            dataset=Dataset.Transactions,
            query="",
            aggregate="sum(transaction.duration)",
            time_window=timedelta(minutes=10),
            environment=None,
            event_types=[SnubaQueryEventType.EventType.TRANSACTION],
            resolution=timedelta(minutes=1),
        )

        query_subscription = QuerySubscription.objects.create(
            project=self.project,
            type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
            snuba_query=snuba_query,
            status=QuerySubscription.Status.ACTIVE.value,
        )

        data_source = self.create_data_source(
            organization=self.org,
            source_id=str(query_subscription.id),
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )

        detector_data_condition_group = self.create_data_condition_group(
            organization=self.org,
        )

        detector = self.create_detector(
            name="Test Detector",
            type=MetricIssue.slug,
            project=self.project,
            config={"detection_type": AlertRuleDetectionType.STATIC.value},
            workflow_condition_group=detector_data_condition_group,
        )

        data_source.detectors.add(detector)

        with self.tasks():
            translate_detector_and_update_subscription_in_snuba(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.extrapolation_mode == ExtrapolationMode.NONE.value

    @with_feature("organizations:migrate-transaction-alerts-to-spans")
    @patch("sentry.snuba.tasks._create_rpc_in_snuba")
    def test_extrapolation_mode_avg_custom_measurement_transactions(self, mock_create_rpc) -> None:
        mock_create_rpc.return_value = "test-subscription-id"

        snuba_query = create_snuba_query(
            query_type=SnubaQuery.Type.PERFORMANCE,
            dataset=Dataset.Transactions,
            query="",
            aggregate="avg(d:spans/exclusive_time@millisecond)",
            time_window=timedelta(minutes=10),
            environment=None,
            event_types=[SnubaQueryEventType.EventType.TRANSACTION],
            resolution=timedelta(minutes=1),
        )

        query_subscription = QuerySubscription.objects.create(
            project=self.project,
            type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
            snuba_query=snuba_query,
            status=QuerySubscription.Status.ACTIVE.value,
        )

        data_source = self.create_data_source(
            organization=self.org,
            source_id=str(query_subscription.id),
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )

        detector_data_condition_group = self.create_data_condition_group(
            organization=self.org,
        )

        detector = self.create_detector(
            name="Test Detector",
            type=MetricIssue.slug,
            project=self.project,
            config={"detection_type": AlertRuleDetectionType.STATIC.value},
            workflow_condition_group=detector_data_condition_group,
        )

        data_source.detectors.add(detector)

        with self.tasks():
            translate_detector_and_update_subscription_in_snuba(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.extrapolation_mode == ExtrapolationMode.CLIENT_AND_SERVER_WEIGHTED.value
        assert snuba_query.aggregate == "avg(span.self_time)"

    @with_feature("organizations:migrate-transaction-alerts-to-spans")
    @patch("sentry.snuba.tasks._create_rpc_in_snuba")
    def test_count_custom_measurement_transactions(self, mock_create_rpc) -> None:
        mock_create_rpc.return_value = "test-subscription-id"

        snuba_query = create_snuba_query(
            query_type=SnubaQuery.Type.PERFORMANCE,
            dataset=Dataset.Transactions,
            query="",
            aggregate="count(d:spans/duration@millisecond)",
            time_window=timedelta(minutes=10),
            environment=None,
            event_types=[SnubaQueryEventType.EventType.TRANSACTION],
            resolution=timedelta(minutes=1),
        )

        query_subscription = QuerySubscription.objects.create(
            project=self.project,
            type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
            snuba_query=snuba_query,
            status=QuerySubscription.Status.ACTIVE.value,
        )

        data_source = self.create_data_source(
            organization=self.org,
            source_id=str(query_subscription.id),
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )

        detector_data_condition_group = self.create_data_condition_group(
            organization=self.org,
        )

        detector = self.create_detector(
            name="Test Detector",
            type=MetricIssue.slug,
            project=self.project,
            config={"detection_type": AlertRuleDetectionType.STATIC.value},
            workflow_condition_group=detector_data_condition_group,
        )

        data_source.detectors.add(detector)

        with self.tasks():
            translate_detector_and_update_subscription_in_snuba(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.extrapolation_mode == ExtrapolationMode.NONE.value
        assert snuba_query.aggregate == "count(span.duration)"
        assert snuba_query.query == "(has:span.duration) AND is_transaction:1"

    @with_feature("organizations:migrate-transaction-alerts-to-spans")
    @patch("sentry.snuba.tasks._create_in_snuba")
    def test_avg_custom_measurement_transactions(self, mock_create_in_snuba) -> None:
        mock_create_in_snuba.return_value = "test-subscription-id"

        snuba_query = create_snuba_query(
            query_type=SnubaQuery.Type.PERFORMANCE,
            dataset=Dataset.Transactions,
            query="",
            aggregate="avg(d:custom/foo@none)",
            time_window=timedelta(minutes=10),
            environment=None,
            event_types=[SnubaQueryEventType.EventType.TRANSACTION],
            resolution=timedelta(minutes=1),
        )

        query_subscription = QuerySubscription.objects.create(
            project=self.project,
            type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
            snuba_query=snuba_query,
            status=QuerySubscription.Status.ACTIVE.value,
        )

        data_source = self.create_data_source(
            organization=self.org,
            source_id=str(query_subscription.id),
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )

        detector_data_condition_group = self.create_data_condition_group(
            organization=self.org,
        )

        detector = self.create_detector(
            name="Test Detector",
            type=MetricIssue.slug,
            project=self.project,
            config={"detection_type": AlertRuleDetectionType.STATIC.value},
            workflow_condition_group=detector_data_condition_group,
        )

        data_source.detectors.add(detector)

        with self.tasks():
            translate_detector_and_update_subscription_in_snuba(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.extrapolation_mode == ExtrapolationMode.CLIENT_AND_SERVER_WEIGHTED.value
        assert snuba_query.aggregate == "avg(foo)"
        assert snuba_query.query == "is_transaction:1"

    @with_feature("organizations:migrate-transaction-alerts-to-spans")
    @patch("sentry.snuba.tasks._create_rpc_in_snuba")
    def test_extrapolation_mode_count_if_performance_metrics(self, mock_create_rpc) -> None:
        mock_create_rpc.return_value = "test-subscription-id"

        snuba_query = create_snuba_query(
            query_type=SnubaQuery.Type.PERFORMANCE,
            dataset=Dataset.PerformanceMetrics,
            query="",
            aggregate="count_if(transaction.duration,greater,100)",
            time_window=timedelta(minutes=10),
            environment=None,
            event_types=[SnubaQueryEventType.EventType.TRANSACTION],
            resolution=timedelta(minutes=1),
        )

        query_subscription = QuerySubscription.objects.create(
            project=self.project,
            type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
            snuba_query=snuba_query,
            status=QuerySubscription.Status.ACTIVE.value,
        )

        data_source = self.create_data_source(
            organization=self.org,
            source_id=str(query_subscription.id),
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )

        detector_data_condition_group = self.create_data_condition_group(
            organization=self.org,
        )

        detector = self.create_detector(
            name="Test Detector",
            type=MetricIssue.slug,
            project=self.project,
            config={"detection_type": AlertRuleDetectionType.STATIC.value},
            workflow_condition_group=detector_data_condition_group,
        )

        data_source.detectors.add(detector)

        with self.tasks():
            translate_detector_and_update_subscription_in_snuba(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.extrapolation_mode == ExtrapolationMode.SERVER_WEIGHTED.value

    @with_feature("organizations:migrate-transaction-alerts-to-spans")
    @patch("sentry.snuba.tasks._create_rpc_in_snuba")
    def test_extrapolation_mode_count_if_transactions(self, mock_create_rpc) -> None:
        mock_create_rpc.return_value = "test-subscription-id"

        snuba_query = create_snuba_query(
            query_type=SnubaQuery.Type.PERFORMANCE,
            dataset=Dataset.Transactions,
            query="",
            aggregate="count_if(transaction.duration,greater,100)",
            time_window=timedelta(minutes=10),
            environment=None,
            event_types=[SnubaQueryEventType.EventType.TRANSACTION],
            resolution=timedelta(minutes=1),
        )

        query_subscription = QuerySubscription.objects.create(
            project=self.project,
            type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
            snuba_query=snuba_query,
            status=QuerySubscription.Status.ACTIVE.value,
        )

        data_source = self.create_data_source(
            organization=self.org,
            source_id=str(query_subscription.id),
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )

        detector_data_condition_group = self.create_data_condition_group(
            organization=self.org,
        )

        detector = self.create_detector(
            name="Test Detector",
            type=MetricIssue.slug,
            project=self.project,
            config={"detection_type": AlertRuleDetectionType.STATIC.value},
            workflow_condition_group=detector_data_condition_group,
        )

        data_source.detectors.add(detector)

        with self.tasks():
            translate_detector_and_update_subscription_in_snuba(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.extrapolation_mode == ExtrapolationMode.NONE.value

    @with_feature("organizations:migrate-transaction-alerts-to-spans")
    @patch("sentry.snuba.tasks._create_rpc_in_snuba")
    def test_extrapolation_mode_p50_transactions(self, mock_create_rpc) -> None:
        mock_create_rpc.return_value = "test-subscription-id"

        snuba_query = create_snuba_query(
            query_type=SnubaQuery.Type.PERFORMANCE,
            dataset=Dataset.Transactions,
            query="",
            aggregate="p50(transaction.duration)",
            time_window=timedelta(minutes=10),
            environment=None,
            event_types=[SnubaQueryEventType.EventType.TRANSACTION],
            resolution=timedelta(minutes=1),
        )

        query_subscription = QuerySubscription.objects.create(
            project=self.project,
            type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
            snuba_query=snuba_query,
            status=QuerySubscription.Status.ACTIVE.value,
        )

        data_source = self.create_data_source(
            organization=self.org,
            source_id=str(query_subscription.id),
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )

        detector_data_condition_group = self.create_data_condition_group(
            organization=self.org,
        )

        detector = self.create_detector(
            name="Test Detector",
            type=MetricIssue.slug,
            project=self.project,
            config={"detection_type": AlertRuleDetectionType.STATIC.value},
            workflow_condition_group=detector_data_condition_group,
        )

        data_source.detectors.add(detector)

        with self.tasks():
            translate_detector_and_update_subscription_in_snuba(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.extrapolation_mode == ExtrapolationMode.CLIENT_AND_SERVER_WEIGHTED.value

    @with_feature("organizations:migrate-transaction-alerts-to-spans")
    @patch("sentry.snuba.tasks._create_rpc_in_snuba")
    def test_translate_multiple_subscriptions_updates_each_correctly(self, mock_create_rpc) -> None:
        """
        Test that when there are multiple subscriptions for a snuba_query,
        each subscription gets its own ID passed to update_subscription_in_snuba.
        This verifies the closure bug fix where lambda captures subscription.id by value.
        """
        # Return unique subscription IDs to avoid unique constraint violation
        mock_create_rpc.side_effect = [
            "test-subscription-id-1",
            "test-subscription-id-2",
            "test-subscription-id-3",
        ]

        snuba_query = create_snuba_query(
            query_type=SnubaQuery.Type.PERFORMANCE,
            dataset=Dataset.PerformanceMetrics,
            query="transaction.duration:>100",
            aggregate="count()",
            time_window=timedelta(minutes=10),
            environment=None,
            event_types=[SnubaQueryEventType.EventType.TRANSACTION],
            resolution=timedelta(minutes=1),
        )

        project2 = self.create_project(organization=self.org)
        project3 = self.create_project(organization=self.org)

        subscription1 = QuerySubscription.objects.create(
            project=self.project,
            type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
            snuba_query=snuba_query,
            status=QuerySubscription.Status.ACTIVE.value,
        )
        subscription2 = QuerySubscription.objects.create(
            project=project2,
            type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
            snuba_query=snuba_query,
            status=QuerySubscription.Status.ACTIVE.value,
        )
        subscription3 = QuerySubscription.objects.create(
            project=project3,
            type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
            snuba_query=snuba_query,
            status=QuerySubscription.Status.ACTIVE.value,
        )

        data_source = self.create_data_source(
            organization=self.org,
            source_id=str(subscription1.id),
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )

        detector_data_condition_group = self.create_data_condition_group(
            organization=self.org,
        )

        detector = self.create_detector(
            name="Test Detector",
            type=MetricIssue.slug,
            project=self.project,
            config={"detection_type": AlertRuleDetectionType.STATIC.value},
            workflow_condition_group=detector_data_condition_group,
        )

        data_source.detectors.add(detector)

        with self.tasks():
            translate_detector_and_update_subscription_in_snuba(snuba_query)

        assert mock_create_rpc.call_count == 3

        # _create_rpc_in_snuba receives the subscription object as the first argument
        called_subscription_ids = {
            call_args[0][0].id for call_args in mock_create_rpc.call_args_list
        }
        expected_subscription_ids = {subscription1.id, subscription2.id, subscription3.id}
        assert called_subscription_ids == expected_subscription_ids

    @with_feature("organizations:migrate-transaction-alerts-to-spans")
    @patch("sentry.explore.translation.alerts_translation.bulk_update_snuba_subscriptions")
    def test_update_snuba_subscription_fails(self, mock_update_subscription_in_snuba) -> None:
        mock_update_subscription_in_snuba.side_effect = SubscriptionError()

        snuba_query = create_snuba_query(
            query_type=SnubaQuery.Type.PERFORMANCE,
            dataset=Dataset.PerformanceMetrics,
            query="transaction.duration:>100",
            aggregate="count(d:spans/webvital.score.total@ratio)",
            time_window=timedelta(minutes=10),
            environment=None,
            event_types=[SnubaQueryEventType.EventType.TRANSACTION],
            resolution=timedelta(minutes=1),
        )

        subscription1 = QuerySubscription.objects.create(
            project=self.project,
            type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
            snuba_query=snuba_query,
            status=QuerySubscription.Status.ACTIVE.value,
        )

        data_source = self.create_data_source(
            organization=self.org,
            source_id=str(subscription1.id),
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )

        detector_data_condition_group = self.create_data_condition_group(
            organization=self.org,
        )

        detector = self.create_detector(
            name="Test Detector",
            type=MetricIssue.slug,
            project=self.project,
            config={"detection_type": AlertRuleDetectionType.STATIC.value},
            workflow_condition_group=detector_data_condition_group,
        )

        data_source.detectors.add(detector)

        with self.tasks(), pytest.raises(SubscriptionError):
            translate_detector_and_update_subscription_in_snuba(snuba_query)

        assert mock_update_subscription_in_snuba.call_count == 1

        snuba_query.refresh_from_db()
        subscription1.refresh_from_db()

        assert snuba_query.dataset == Dataset.PerformanceMetrics.value
        assert snuba_query.extrapolation_mode == ExtrapolationMode.UNKNOWN.value
        assert subscription1.status == QuerySubscription.Status.ACTIVE.value

    @with_feature("organizations:migrate-transaction-alerts-to-spans")
    @patch("sentry.snuba.tasks._create_rpc_in_snuba")
    def test_rollback_skips_user_updated_query(self, mock_create_rpc) -> None:
        mock_create_rpc.return_value = "test-subscription-id"

        snuba_query = create_snuba_query(
            query_type=SnubaQuery.Type.PERFORMANCE,
            dataset=Dataset.Transactions,
            query="transaction.duration:>100",
            aggregate="count()",
            time_window=timedelta(minutes=10),
            environment=None,
            event_types=[SnubaQueryEventType.EventType.TRANSACTION],
            resolution=timedelta(minutes=1),
        )

        query_subscription = QuerySubscription.objects.create(
            project=self.project,
            type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
            snuba_query=snuba_query,
            status=QuerySubscription.Status.ACTIVE.value,
        )

        data_source = self.create_data_source(
            organization=self.org,
            source_id=str(query_subscription.id),
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )

        detector_data_condition_group = self.create_data_condition_group()

        detector = self.create_detector(
            name="Test Detector",
            type=MetricIssue.slug,
            project=self.project,
            config={
                "detection_type": AlertRuleDetectionType.STATIC.value,
            },
            workflow_condition_group=detector_data_condition_group,
        )

        data_source.detectors.add(detector)

        translate_detector_and_update_subscription_in_snuba(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.dataset == Dataset.EventsAnalyticsPlatform.value
        assert snuba_query.query_snapshot is not None
        assert snuba_query.query_snapshot.get("user_updated") is None

        snuba_query.query_snapshot["user_updated"] = True
        snuba_query.save()

        rollback_detector_query_and_update_subscription_in_snuba(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.dataset == Dataset.EventsAnalyticsPlatform.value
