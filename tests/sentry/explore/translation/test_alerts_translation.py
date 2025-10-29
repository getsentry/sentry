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
    rollback_alert_rule_query_and_update_subscription_in_snuba,
    snapshot_snuba_query,
    translate_alert_rule_and_update_subscription_in_snuba,
)
from sentry.incidents.models.alert_rule import (
    AlertRuleDetectionType,
    AlertRuleSeasonality,
    AlertRuleSensitivity,
)
from sentry.seer.anomaly_detection.store_data import SeerMethod, StoreDataResponse
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import ExtrapolationMode, SnubaQueryEventType
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.features import with_feature

pytestmark = pytest.mark.sentry_metrics


class AlertsTranslationTestCase(TestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.org = self.create_organization()
        self.project = self.create_project(organization=self.org)

    def test_snapshot_snuba_query_with_performance_metrics(self) -> None:
        alert_rule = self.create_alert_rule(
            organization=self.org,
            projects=[self.project],
            name="Test Alert",
            query="transaction.duration:>100",
            aggregate="count()",
            time_window=10,
            dataset=Dataset.PerformanceMetrics,
        )
        snuba_query = alert_rule.snuba_query

        assert snuba_query.query_snapshot is None

        snapshot_snuba_query(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.query_snapshot is not None
        assert snuba_query.query_snapshot["type"] == snuba_query.type
        assert snuba_query.query_snapshot["dataset"] == Dataset.PerformanceMetrics.value
        assert snuba_query.query_snapshot["query"] == "transaction.duration:>100"
        assert snuba_query.query_snapshot["aggregate"] == "count()"
        assert snuba_query.query_snapshot["time_window"] == snuba_query.time_window

    def test_snapshot_snuba_query_with_transactions(self) -> None:
        alert_rule = self.create_alert_rule(
            organization=self.org,
            projects=[self.project],
            name="Test Alert",
            query="transaction.duration:>100",
            aggregate="p95(transaction.duration)",
            time_window=10,
            dataset=Dataset.Transactions,
        )
        snuba_query = alert_rule.snuba_query

        assert snuba_query.query_snapshot is None

        snapshot_snuba_query(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.query_snapshot is not None
        assert snuba_query.query_snapshot["type"] == snuba_query.type
        assert snuba_query.query_snapshot["dataset"] == Dataset.Transactions.value
        assert snuba_query.query_snapshot["query"] == "transaction.duration:>100"
        assert snuba_query.query_snapshot["aggregate"] == "p95(transaction.duration)"
        assert snuba_query.query_snapshot["time_window"] == snuba_query.time_window

    def test_snapshot_snuba_query_with_events_dataset(self) -> None:
        alert_rule = self.create_alert_rule(
            organization=self.org,
            projects=[self.project],
            name="Test Alert",
            query="level:error",
            aggregate="count()",
            time_window=10,
            dataset=Dataset.Events,
        )
        snuba_query = alert_rule.snuba_query

        assert snuba_query.query_snapshot is None

        snapshot_snuba_query(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.query_snapshot is None

    @patch("sentry.snuba.tasks._create_rpc_in_snuba")
    def test_translate_alert_rule_simple_count(self, mock_create_rpc) -> None:
        mock_create_rpc.return_value = "test-subscription-id"

        alert_rule = self.create_alert_rule(
            organization=self.org,
            projects=[self.project],
            name="Test Alert",
            query="transaction.duration:>100",
            aggregate="count()",
            time_window=10,
            dataset=Dataset.PerformanceMetrics,
        )
        snuba_query = alert_rule.snuba_query
        original_dataset = snuba_query.dataset

        assert snuba_query.query_snapshot is None
        assert snuba_query.dataset == Dataset.PerformanceMetrics.value

        translate_alert_rule_and_update_subscription_in_snuba(alert_rule)
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
        assert expression.aggregation.key.name == "sentry.duration_ms"
        assert expression.aggregation.label == "count(span.duration)"
        assert (
            expression.aggregation.extrapolation_mode
            == RPCExtrapolationMode.EXTRAPOLATION_MODE_SAMPLE_WEIGHTED
        )
        assert expression.label == "count(span.duration)"

        assert len(rpc_time_series_request.group_by) == 0

    @patch("sentry.snuba.tasks._create_rpc_in_snuba")
    def test_translate_alert_rule_p95(self, mock_create_rpc) -> None:
        mock_create_rpc.return_value = "test-subscription-id"

        alert_rule = self.create_alert_rule(
            organization=self.org,
            projects=[self.project],
            name="Test Alert",
            query="http.method:GET",
            aggregate="p95(transaction.duration)",
            time_window=10,
            dataset=Dataset.Transactions,
        )
        snuba_query = alert_rule.snuba_query

        assert snuba_query.dataset == Dataset.Transactions.value

        translate_alert_rule_and_update_subscription_in_snuba(alert_rule)
        snuba_query.refresh_from_db()

        assert snuba_query.dataset == Dataset.EventsAnalyticsPlatform.value
        assert snuba_query.aggregate == "p95(span.duration)"
        assert snuba_query.query == "(transaction.method:GET) AND is_transaction:1"
        assert snuba_query.extrapolation_mode == ExtrapolationMode.NONE.value

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

    @patch("sentry.snuba.tasks._create_rpc_in_snuba")
    def test_translate_alert_rule_count_unique(self, mock_create_rpc) -> None:
        mock_create_rpc.return_value = "test-subscription-id"

        alert_rule = self.create_alert_rule(
            organization=self.org,
            projects=[self.project],
            name="Test Alert",
            query="transaction:/api/*",
            aggregate="count_unique(user)",
            time_window=10,
            dataset=Dataset.PerformanceMetrics,
        )
        snuba_query = alert_rule.snuba_query

        translate_alert_rule_and_update_subscription_in_snuba(alert_rule)
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

    @patch("sentry.snuba.tasks._create_rpc_in_snuba")
    def test_translate_alert_rule_empty_query(self, mock_create_rpc) -> None:
        mock_create_rpc.return_value = "test-subscription-id"

        alert_rule = self.create_alert_rule(
            organization=self.org,
            projects=[self.project],
            name="Test Alert",
            query="",
            aggregate="count()",
            time_window=10,
            dataset=Dataset.Transactions,
        )
        snuba_query = alert_rule.snuba_query

        translate_alert_rule_and_update_subscription_in_snuba(alert_rule)
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

    @patch("sentry.snuba.tasks._delete_from_snuba")
    @patch("sentry.snuba.tasks._create_snql_in_snuba")
    @patch("sentry.snuba.tasks._create_rpc_in_snuba")
    def test_rollback_alert_rule_query(
        self, mock_create_rpc, mock_create_snql, mock_delete
    ) -> None:
        mock_create_rpc.return_value = "test-subscription-id"
        mock_create_snql.return_value = "rollback-subscription-id"
        mock_delete.return_value = None

        alert_rule = self.create_alert_rule(
            organization=self.org,
            projects=[self.project],
            name="Test Alert",
            query="transaction.duration:>100",
            aggregate="count()",
            time_window=10,
            dataset=Dataset.Transactions,
        )
        snuba_query = alert_rule.snuba_query

        original_type = snuba_query.type
        original_dataset = snuba_query.dataset
        original_query = snuba_query.query
        original_aggregate = snuba_query.aggregate
        original_time_window = snuba_query.time_window

        translate_alert_rule_and_update_subscription_in_snuba(alert_rule)
        snuba_query.refresh_from_db()

        assert snuba_query.dataset == Dataset.EventsAnalyticsPlatform.value

        assert mock_create_rpc.called
        assert mock_create_rpc.call_count == 1

        rollback_alert_rule_query_and_update_subscription_in_snuba(alert_rule)
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

    def test_rollback_without_snapshot(self) -> None:
        alert_rule = self.create_alert_rule(
            organization=self.org,
            projects=[self.project],
            name="Test Alert",
            query="transaction.duration:>100",
            aggregate="count()",
            time_window=10,
            dataset=Dataset.Events,
        )
        snuba_query = alert_rule.snuba_query

        original_dataset = snuba_query.dataset

        rollback_alert_rule_query_and_update_subscription_in_snuba(alert_rule)
        snuba_query.refresh_from_db()

        assert snuba_query.dataset == original_dataset
        assert snuba_query.query_snapshot is None

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:incidents")
    @patch("sentry.snuba.tasks._create_rpc_in_snuba")
    @patch(
        "sentry.explore.translation.alerts_translation.handle_send_historical_data_to_seer_legacy"
    )
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_translate_anomaly_detection_alert(
        self, mock_seer_request, mock_seer_legacy, mock_create_rpc
    ) -> None:

        mock_create_rpc.return_value = "test-subscription-id"
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        alert_rule = self.create_alert_rule(
            organization=self.org,
            projects=[self.project],
            name="Anomaly Detection Alert",
            query="transaction.duration:>100",
            aggregate="count()",
            time_window=15,
            dataset=Dataset.PerformanceMetrics,
            detection_type=AlertRuleDetectionType.DYNAMIC,
            sensitivity=AlertRuleSensitivity.LOW,
            seasonality=AlertRuleSeasonality.AUTO,
            event_types=[SnubaQueryEventType.EventType.TRANSACTION],
        )
        snuba_query = alert_rule.snuba_query

        translate_alert_rule_and_update_subscription_in_snuba(alert_rule)
        snuba_query.refresh_from_db()

        assert snuba_query.dataset == Dataset.EventsAnalyticsPlatform.value
        assert snuba_query.aggregate == "count(span.duration)"

        assert mock_seer_legacy.called
        assert mock_seer_legacy.call_count == 1

        call_args = mock_seer_legacy.call_args
        alert_rule_arg = call_args[0][0]
        snuba_query_arg = call_args[0][1]
        project_arg = call_args[0][2]
        seer_method_arg = call_args[0][3]
        event_types_arg = call_args[1]["event_types"]

        assert alert_rule_arg.id == alert_rule.id
        assert snuba_query_arg.id == snuba_query.id
        assert snuba_query_arg.dataset == Dataset.EventsAnalyticsPlatform.value
        assert project_arg.id == self.project.id
        assert seer_method_arg == SeerMethod.UPDATE
        assert event_types_arg == [SnubaQueryEventType.EventType.TRACE_ITEM_SPAN]

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:incidents")
    @patch("sentry.snuba.tasks._delete_from_snuba")
    @patch("sentry.snuba.tasks._create_snql_in_snuba")
    @patch("sentry.snuba.tasks._create_rpc_in_snuba")
    @patch(
        "sentry.explore.translation.alerts_translation.handle_send_historical_data_to_seer_legacy"
    )
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_rollback_anomaly_detection_alert(
        self,
        mock_seer_request,
        mock_seer_legacy,
        mock_create_rpc,
        mock_create_snql,
        mock_delete,
    ) -> None:
        mock_create_rpc.return_value = "test-subscription-id"
        mock_create_snql.return_value = "rollback-subscription-id"
        mock_delete.return_value = None
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        alert_rule = self.create_alert_rule(
            organization=self.org,
            projects=[self.project],
            name="Anomaly Detection Alert",
            query="transaction.duration:>100",
            aggregate="count()",
            time_window=15,
            dataset=Dataset.Transactions,
            detection_type=AlertRuleDetectionType.DYNAMIC,
            sensitivity=AlertRuleSensitivity.LOW,
            seasonality=AlertRuleSeasonality.AUTO,
            event_types=[SnubaQueryEventType.EventType.TRANSACTION],
        )
        snuba_query = alert_rule.snuba_query

        original_dataset = snuba_query.dataset

        translate_alert_rule_and_update_subscription_in_snuba(alert_rule)
        snuba_query.refresh_from_db()

        assert snuba_query.dataset == Dataset.EventsAnalyticsPlatform.value
        assert mock_seer_legacy.call_count == 1

        rollback_alert_rule_query_and_update_subscription_in_snuba(alert_rule)
        snuba_query.refresh_from_db()

        assert snuba_query.dataset == original_dataset
        assert mock_seer_legacy.call_count == 2

        rollback_call_args = mock_seer_legacy.call_args_list[1]
        alert_rule_arg = rollback_call_args[0][0]
        snuba_query_arg = rollback_call_args[0][1]
        project_arg = rollback_call_args[0][2]
        seer_method_arg = rollback_call_args[0][3]
        event_types_arg = rollback_call_args[1]["event_types"]

        assert alert_rule_arg.id == alert_rule.id
        assert snuba_query_arg.id == snuba_query.id
        assert snuba_query_arg.dataset == Dataset.Transactions.value
        assert project_arg.id == self.project.id
        assert seer_method_arg == SeerMethod.UPDATE
        assert event_types_arg == [SnubaQueryEventType.EventType.TRANSACTION]
