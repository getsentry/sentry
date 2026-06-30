from unittest import mock

from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import (
    ExtrapolationMode,
    SnubaQueryEventType as SnubaQueryEventTypeClass,
)
from sentry.testutils.cases import SnubaTestCase, TestMigrations
from sentry.uptime.types import DATA_SOURCE_UPTIME_SUBSCRIPTION


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

    def setup_before_migration(self, apps):
        SnubaQuery = apps.get_model("sentry", "SnubaQuery")
        QuerySubscription = apps.get_model("sentry", "QuerySubscription")
        SnubaQueryEventType = apps.get_model("sentry", "SnubaQueryEventType")

        # transaction alert
        self.transaction_snuba_query = SnubaQuery.objects.create(
            type=1,  # Performance type,
            dataset=Dataset.Transactions.value,
            query="transaction.duration:>100",
            aggregate="apdex(300)",
            time_window=3600,
            resolution=60,
            environment=None,
        )

        SnubaQueryEventType.objects.create(
            snuba_query=self.transaction_snuba_query,
            type=SnubaQueryEventTypeClass.EventType.TRANSACTION.value,
        )

        self.transaction_query_subscription = QuerySubscription.objects.create(
            project_id=self.project.id,
            type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
            snuba_query=self.transaction_snuba_query,
            status=0,  # active,
        )

        self.transaction_data_source = self.create_data_source(
            organization=self.organization,
            source_id=str(self.transaction_query_subscription.id),
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )

        self.transaction_detector_data_condition_group = self.create_data_condition_group(
            organization=self.organization,
        )

        self.transaction_detector = self.create_detector(
            name="Test Transaction Detector",
            project=self.project,
            type=MetricIssue.slug,
            config={"detection_type": AlertRuleDetectionType.STATIC.value},
            created_by_id=self.user.id,
            workflow_condition_group=self.transaction_detector_data_condition_group,
        )

        # generic metric alert
        self.generic_metric_snuba_query = SnubaQuery.objects.create(
            type=1,  # Performance type
            dataset=Dataset.PerformanceMetrics.value,
            query="event.type:transaction",
            aggregate="count()",
            time_window=3600,
            resolution=60,
            environment=None,
        )

        SnubaQueryEventType.objects.create(
            snuba_query=self.generic_metric_snuba_query,
            type=SnubaQueryEventTypeClass.EventType.TRANSACTION.value,
        )

        self.generic_metric_query_subscription = QuerySubscription.objects.create(
            project_id=self.project.id,
            type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
            snuba_query=self.generic_metric_snuba_query,
            status=0,  # active
        )

        self.generic_metric_data_source = self.create_data_source(
            organization=self.organization,
            source_id=str(self.generic_metric_query_subscription.id),
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )

        self.generic_metric_detector_data_condition_group = self.create_data_condition_group(
            organization=self.organization,
        )

        self.generic_metric_detector = self.create_detector(
            name="Test Generic Metric Detector",
            project=self.project,
            type=MetricIssue.slug,
            config={"detection_type": AlertRuleDetectionType.STATIC.value},
            created_by_id=self.user.id,
            workflow_condition_group=self.generic_metric_detector_data_condition_group,
        )

        # span alert
        self.span_snuba_query = SnubaQuery.objects.create(
            type=1,  # Performance type
            dataset=Dataset.EventsAnalyticsPlatform.value,
            query="",
            aggregate="count_unique(span.op)",
            time_window=3600,
            resolution=60,
            environment=None,
        )

        SnubaQueryEventType.objects.create(
            snuba_query=self.span_snuba_query,
            type=SnubaQueryEventTypeClass.EventType.TRACE_ITEM_SPAN.value,
        )

        self.span_query_subscription = QuerySubscription.objects.create(
            project_id=self.project.id,
            type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
            snuba_query=self.span_snuba_query,
            status=0,  # active
        )

        self.span_data_source = self.create_data_source(
            organization=self.organization,
            source_id=str(self.span_query_subscription.id),
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )

        self.span_detector_data_condition_group = self.create_data_condition_group(
            organization=self.organization,
        )

        self.span_detector = self.create_detector(
            name="Test Span Detector",
            project=self.project,
            type=MetricIssue.slug,
            config={"detection_type": AlertRuleDetectionType.STATIC.value},
            created_by_id=self.user.id,
            workflow_condition_group=self.span_detector_data_condition_group,
        )

        # inactive query subscription
        self.inactive_transaction_snuba_query = SnubaQuery.objects.create(
            type=1,  # Performance type
            dataset=Dataset.Transactions.value,
            query="transaction.duration:>100",
            aggregate="apdex(300)",
            time_window=3600,
            resolution=60,
            environment=None,
        )

        SnubaQueryEventType.objects.create(
            snuba_query=self.inactive_transaction_snuba_query,
            type=SnubaQueryEventTypeClass.EventType.TRANSACTION.value,
        )

        self.inactive_transaction_query_subscription = QuerySubscription.objects.create(
            project_id=self.project.id,
            type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
            snuba_query=self.inactive_transaction_snuba_query,
            status=4,  # disabled
        )

        self.inactive_transaction_data_source = self.create_data_source(
            organization=self.organization,
            source_id=str(self.inactive_transaction_query_subscription.id),
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )

        self.inactive_transaction_detector_data_condition_group = self.create_data_condition_group(
            organization=self.organization,
        )

        self.inactive_transaction_detector = self.create_detector(
            name="Test Transaction Detector",
            project=self.project,
            type=MetricIssue.slug,
            config={"detection_type": AlertRuleDetectionType.STATIC.value},
            created_by_id=self.user.id,
            workflow_condition_group=self.inactive_transaction_detector_data_condition_group,
        )

        # no data source (wrong type)
        self.wrong_subscription_type_snuba_query = SnubaQuery.objects.create(
            type=1,  # Performance type
            dataset=Dataset.Transactions.value,
            query="transaction.duration:>100",
            aggregate="apdex(300)",
            time_window=3600,
            resolution=60,
            environment=None,
        )

        SnubaQueryEventType.objects.create(
            snuba_query=self.wrong_subscription_type_snuba_query,
            type=SnubaQueryEventTypeClass.EventType.TRANSACTION.value,
        )

        self.wrong_subscription_type_query_subscription = QuerySubscription.objects.create(
            project_id=self.project.id,
            type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
            snuba_query=self.wrong_subscription_type_snuba_query,
            status=0,  # active
        )

        self.wrong_subscription_type_data_source = self.create_data_source(
            organization=self.organization,
            source_id=str(self.wrong_subscription_type_query_subscription.id),
            type=DATA_SOURCE_UPTIME_SUBSCRIPTION,
        )

        self.wrong_subscription_type_detector_data_condition_group = (
            self.create_data_condition_group(
                organization=self.organization,
            )
        )

        self.wrong_subscription_type_detector = self.create_detector(
            name="Test Transaction Detector",
            project=self.project,
            type=MetricIssue.slug,
            config={"detection_type": AlertRuleDetectionType.STATIC.value},
            created_by_id=self.user.id,
            workflow_condition_group=self.wrong_subscription_type_detector_data_condition_group,
        )

        # transaction anomaly detection alert (should work)
        self.transaction_anomaly_detection_snuba_query = SnubaQuery.objects.create(
            type=1,  # Performance type,
            dataset=Dataset.Transactions.value,
            query="transaction.duration:>100",
            aggregate="apdex(300)",
            time_window=3600,
            resolution=60,
            environment=None,
        )

        SnubaQueryEventType.objects.create(
            snuba_query=self.transaction_anomaly_detection_snuba_query,
            type=SnubaQueryEventTypeClass.EventType.TRANSACTION.value,
        )

        self.transaction_anomaly_detection_query_subscription = QuerySubscription.objects.create(
            project_id=self.project.id,
            type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
            snuba_query=self.transaction_anomaly_detection_snuba_query,
            status=0,  # active
        )

        self.transaction_anomaly_detection_data_source = self.create_data_source(
            organization=self.organization,
            source_id=str(self.transaction_anomaly_detection_query_subscription.id),
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )

        self.transaction_anomaly_detection_detector_data_condition_group = (
            self.create_data_condition_group(
                organization=self.organization,
            )
        )

        self.transaction_anomaly_detection_detector = self.create_detector(
            name="Test Transaction Detector",
            project=self.project,
            type=MetricIssue.slug,
            config={"detection_type": AlertRuleDetectionType.DYNAMIC.value},
            created_by_id=self.user.id,
            workflow_condition_group=self.transaction_anomaly_detection_detector_data_condition_group,
        )

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
