from unittest import mock

import pytest

from sentry.snuba.dataset import Dataset
from sentry.snuba.models import (
    ExtrapolationMode,
    SnubaQueryEventType as SnubaQueryEventTypeClass,
)
from sentry.testutils.cases import SnubaTestCase, TestMigrations


@pytest.mark.skip(
    reason="Test fixtures build rows with the current model, which fails once a model "
    "gains a field newer than migrate_from's schema"
)
class MigrateTransactionsToSpansAlertsSelfHostedTest(TestMigrations, SnubaTestCase):
    migrate_from = "1124_weeklyreportprojectexclusion"
    migrate_to = "1125_transactions_to_spans_alerts_self_hosted"

    def setUp(self):
        # mock the _create_rpc_in_snuba function to return a unique subscription id for each migrated query
        counter = iter(range(1000))
        with (
            mock.patch(
                "sentry.snuba.tasks._create_rpc_in_snuba",
                side_effect=lambda *args, **kwargs: f"test-subscription-id-{next(counter)}",
            ),
            self.tasks(),
        ):
            super().setUp()

    def test(self):
        self.transaction_snuba_query.refresh_from_db()
        self.generic_metric_snuba_query.refresh_from_db()
        self.span_snuba_query.refresh_from_db()
        self.inactive_transaction_snuba_query.refresh_from_db()
        self.wrong_subscription_type_snuba_query.refresh_from_db()
        self.transaction_anomaly_detection_snuba_query.refresh_from_db()
        self.transaction_query_subscription.refresh_from_db()
        self.generic_metric_query_subscription.refresh_from_db()
        self.span_query_subscription.refresh_from_db()
        self.inactive_transaction_query_subscription.refresh_from_db()
        self.wrong_subscription_type_query_subscription.refresh_from_db()
        self.transaction_anomaly_detection_query_subscription.refresh_from_db()

        QuerySubscription = self.apps.get_model("sentry", "QuerySubscription")
        SnubaQueryEventType = self.apps.get_model("sentry", "SnubaQueryEventType")

        # transaction alert
        assert self.transaction_snuba_query.dataset == Dataset.EventsAnalyticsPlatform.value
        transaction_event_type = SnubaQueryEventType.objects.filter(
            snuba_query_id=self.transaction_snuba_query.id,
        ).first()
        assert (
            transaction_event_type.type == SnubaQueryEventTypeClass.EventType.TRACE_ITEM_SPAN.value
        )
        assert self.transaction_snuba_query.query == "(span.duration:>100) AND is_transaction:1"
        assert self.transaction_snuba_query.aggregate == "apdex(span.duration,300)"
        assert (
            self.transaction_snuba_query.extrapolation_mode
            == ExtrapolationMode.CLIENT_AND_SERVER_WEIGHTED.value
        )
        assert self.transaction_snuba_query.query_snapshot is not None
        new_transaction_query_subscription = QuerySubscription.objects.get(
            snuba_query_id=self.transaction_snuba_query.id
        )
        assert new_transaction_query_subscription.status == 0  # active

        # generic metrics alert
        assert self.generic_metric_snuba_query.dataset == Dataset.EventsAnalyticsPlatform.value
        generic_metric_event_type = SnubaQueryEventType.objects.filter(
            snuba_query_id=self.generic_metric_snuba_query.id,
        ).first()
        assert (
            generic_metric_event_type.type
            == SnubaQueryEventTypeClass.EventType.TRACE_ITEM_SPAN.value
        )
        assert self.generic_metric_snuba_query.query == "(is_transaction:1) AND is_transaction:1"
        assert self.generic_metric_snuba_query.aggregate == "count(span.duration)"
        assert (
            self.generic_metric_snuba_query.extrapolation_mode
            == ExtrapolationMode.SERVER_WEIGHTED.value
        )
        assert self.generic_metric_snuba_query.query_snapshot is not None
        new_generic_metric_query_subscription = QuerySubscription.objects.get(
            snuba_query_id=self.generic_metric_snuba_query.id
        )
        assert new_generic_metric_query_subscription.status == 0  # active

        # span alert (shouldn't change)
        assert self.span_snuba_query.dataset == Dataset.EventsAnalyticsPlatform.value
        span_event_type = SnubaQueryEventType.objects.filter(
            snuba_query_id=self.span_snuba_query.id,
        ).first()
        assert span_event_type.type == SnubaQueryEventTypeClass.EventType.TRACE_ITEM_SPAN.value
        assert self.span_snuba_query.query == ""
        assert self.span_snuba_query.aggregate == "count_unique(span.op)"
        assert self.span_snuba_query.extrapolation_mode == ExtrapolationMode.UNKNOWN.value
        assert self.span_snuba_query.query_snapshot is None
        new_span_query_subscription = QuerySubscription.objects.get(
            snuba_query_id=self.span_snuba_query.id
        )
        assert self.span_query_subscription.id == new_span_query_subscription.id

        # inactive query subscription (shouldn't change)
        assert self.inactive_transaction_snuba_query.dataset == Dataset.Transactions.value
        inactive_transaction_event_type = SnubaQueryEventType.objects.filter(
            snuba_query_id=self.inactive_transaction_snuba_query.id,
        ).first()
        assert (
            inactive_transaction_event_type.type
            == SnubaQueryEventTypeClass.EventType.TRANSACTION.value
        )
        assert self.inactive_transaction_snuba_query.query == "transaction.duration:>100"
        assert self.inactive_transaction_snuba_query.aggregate == "apdex(300)"
        assert self.inactive_transaction_snuba_query.query_snapshot is None
        # no change in query subscription
        new_inactive_transaction_query_subscription = QuerySubscription.objects.get(
            snuba_query_id=self.inactive_transaction_snuba_query.id
        )
        assert (
            new_inactive_transaction_query_subscription.status == 4  # disabled
        )

        # no data source (wrong type) (shouldn't change)
        assert self.wrong_subscription_type_snuba_query.dataset == Dataset.Transactions.value
        wrong_subscription_type_event_type = SnubaQueryEventType.objects.filter(
            snuba_query_id=self.wrong_subscription_type_snuba_query.id,
        ).first()
        assert (
            wrong_subscription_type_event_type.type
            == SnubaQueryEventTypeClass.EventType.TRANSACTION.value
        )
        assert self.wrong_subscription_type_snuba_query.query == "transaction.duration:>100"
        assert self.wrong_subscription_type_snuba_query.aggregate == "apdex(300)"
        assert self.wrong_subscription_type_snuba_query.query_snapshot is None
        # no change in query subscription
        new_wrong_subscription_type_query_subscription = QuerySubscription.objects.get(
            snuba_query_id=self.wrong_subscription_type_snuba_query.id
        )
        assert new_wrong_subscription_type_query_subscription.status == 0  # active

        # transaction anomaly detection alert (should work)
        assert (
            self.transaction_anomaly_detection_snuba_query.dataset
            == Dataset.EventsAnalyticsPlatform.value
        )
        transaction_anomaly_detection_event_type = SnubaQueryEventType.objects.filter(
            snuba_query_id=self.transaction_anomaly_detection_snuba_query.id,
        ).first()
        assert (
            transaction_anomaly_detection_event_type.type
            == SnubaQueryEventTypeClass.EventType.TRACE_ITEM_SPAN.value
        )
        assert (
            self.transaction_anomaly_detection_snuba_query.query
            == "(span.duration:>100) AND is_transaction:1"
        )
        assert (
            self.transaction_anomaly_detection_snuba_query.aggregate == "apdex(span.duration,300)"
        )
        assert (
            self.transaction_anomaly_detection_snuba_query.extrapolation_mode
            == ExtrapolationMode.CLIENT_AND_SERVER_WEIGHTED.value
        )
        assert self.transaction_anomaly_detection_snuba_query.query_snapshot is not None
        new_transaction_anomaly_detection_query_subscription = QuerySubscription.objects.get(
            snuba_query_id=self.transaction_anomaly_detection_snuba_query.id
        )
        assert new_transaction_anomaly_detection_query_subscription.status == 0  # active
