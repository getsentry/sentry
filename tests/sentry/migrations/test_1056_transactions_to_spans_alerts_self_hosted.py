from unittest import mock

from sentry.hybridcloud.models.outbox import outbox_context
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import (
    ExtrapolationMode,
    QuerySubscription,
    SnubaQuery,
    SnubaQueryEventType,
)
from sentry.testutils.cases import SnubaTestCase, TestMigrations
from sentry.uptime.types import DATA_SOURCE_UPTIME_SUBSCRIPTION


class MigrateTransactionsToSpansAlertsSelfHostedTest(TestMigrations, SnubaTestCase):
    migrate_from = "1055_rename_regiontombstone_to_celltombstone"
    migrate_to = "1056_transactions_to_spans_alerts_self_hosted"

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
        with outbox_context(flush=False):
            self.org = Organization.objects.create(name="Test Organization", slug="test")
            self.project = Project.objects.create(name="Test Project", organization=self.org)

            # transaction alert
            self.transaction_snuba_query = SnubaQuery.objects.create(
                type=SnubaQuery.Type.PERFORMANCE.value,
                dataset=Dataset.Transactions.value,
                query="transaction.duration:>100",
                aggregate="apdex(300)",
                time_window=3600,
                resolution=60,
                environment=None,
            )

            SnubaQueryEventType.objects.create(
                snuba_query=self.transaction_snuba_query,
                type=SnubaQueryEventType.EventType.TRANSACTION.value,
            )

            self.transaction_query_subscription = QuerySubscription.objects.create(
                project=self.project,
                type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
                snuba_query=self.transaction_snuba_query,
                status=QuerySubscription.Status.ACTIVE.value,
            )

            self.transaction_data_source = self.create_data_source(
                organization=self.org,
                source_id=str(self.transaction_query_subscription.id),
                type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
            )

            self.transaction_detector_data_condition_group = self.create_data_condition_group(
                organization=self.org,
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
                type=SnubaQuery.Type.PERFORMANCE.value,
                dataset=Dataset.PerformanceMetrics.value,
                query="event.type:transaction",
                aggregate="count()",
                time_window=3600,
                resolution=60,
                environment=None,
            )

            SnubaQueryEventType.objects.create(
                snuba_query=self.generic_metric_snuba_query,
                type=SnubaQueryEventType.EventType.TRANSACTION.value,
            )

            self.generic_metric_query_subscription = QuerySubscription.objects.create(
                project=self.project,
                type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
                snuba_query=self.generic_metric_snuba_query,
                status=QuerySubscription.Status.ACTIVE.value,
            )

            self.generic_metric_data_source = self.create_data_source(
                organization=self.org,
                source_id=str(self.generic_metric_query_subscription.id),
                type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
            )

            self.generic_metric_detector_data_condition_group = self.create_data_condition_group(
                organization=self.org,
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
                type=SnubaQuery.Type.PERFORMANCE.value,
                dataset=Dataset.EventsAnalyticsPlatform.value,
                query="",
                aggregate="count_unique(span.op)",
                time_window=3600,
                resolution=60,
                environment=None,
            )

            SnubaQueryEventType.objects.create(
                snuba_query=self.span_snuba_query,
                type=SnubaQueryEventType.EventType.TRACE_ITEM_SPAN.value,
            )

            self.span_query_subscription = QuerySubscription.objects.create(
                project=self.project,
                type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
                snuba_query=self.span_snuba_query,
                status=QuerySubscription.Status.ACTIVE.value,
            )

            self.span_data_source = self.create_data_source(
                organization=self.org,
                source_id=str(self.span_query_subscription.id),
                type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
            )

            self.span_detector_data_condition_group = self.create_data_condition_group(
                organization=self.org,
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
                type=SnubaQuery.Type.PERFORMANCE.value,
                dataset=Dataset.Transactions.value,
                query="transaction.duration:>100",
                aggregate="apdex(300)",
                time_window=3600,
                resolution=60,
                environment=None,
            )

            SnubaQueryEventType.objects.create(
                snuba_query=self.inactive_transaction_snuba_query,
                type=SnubaQueryEventType.EventType.TRANSACTION.value,
            )

            self.inactive_transaction_query_subscription = QuerySubscription.objects.create(
                project=self.project,
                type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
                snuba_query=self.inactive_transaction_snuba_query,
                status=QuerySubscription.Status.DISABLED.value,
            )

            self.inactive_transaction_data_source = self.create_data_source(
                organization=self.org,
                source_id=str(self.inactive_transaction_query_subscription.id),
                type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
            )

            self.inactive_transaction_detector_data_condition_group = (
                self.create_data_condition_group(
                    organization=self.org,
                )
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
                type=SnubaQuery.Type.PERFORMANCE.value,
                dataset=Dataset.Transactions.value,
                query="transaction.duration:>100",
                aggregate="apdex(300)",
                time_window=3600,
                resolution=60,
                environment=None,
            )

            SnubaQueryEventType.objects.create(
                snuba_query=self.wrong_subscription_type_snuba_query,
                type=SnubaQueryEventType.EventType.TRANSACTION.value,
            )

            self.wrong_subscription_type_query_subscription = QuerySubscription.objects.create(
                project=self.project,
                type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
                snuba_query=self.wrong_subscription_type_snuba_query,
                status=QuerySubscription.Status.ACTIVE.value,
            )

            self.wrong_subscription_type_data_source = self.create_data_source(
                organization=self.org,
                source_id=str(self.wrong_subscription_type_query_subscription.id),
                type=DATA_SOURCE_UPTIME_SUBSCRIPTION,
            )

            self.wrong_subscription_type_detector_data_condition_group = (
                self.create_data_condition_group(
                    organization=self.org,
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
                type=SnubaQuery.Type.PERFORMANCE.value,
                dataset=Dataset.Transactions.value,
                query="transaction.duration:>100",
                aggregate="apdex(300)",
                time_window=3600,
                resolution=60,
                environment=None,
            )

            SnubaQueryEventType.objects.create(
                snuba_query=self.transaction_anomaly_detection_snuba_query,
                type=SnubaQueryEventType.EventType.TRANSACTION.value,
            )

            self.transaction_anomaly_detection_query_subscription = (
                QuerySubscription.objects.create(
                    project=self.project,
                    type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
                    snuba_query=self.transaction_anomaly_detection_snuba_query,
                    status=QuerySubscription.Status.ACTIVE.value,
                )
            )

            self.transaction_anomaly_detection_data_source = self.create_data_source(
                organization=self.org,
                source_id=str(self.transaction_anomaly_detection_query_subscription.id),
                type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
            )

            self.transaction_anomaly_detection_detector_data_condition_group = (
                self.create_data_condition_group(
                    organization=self.org,
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

        # transaction alert
        assert self.transaction_snuba_query.dataset == Dataset.EventsAnalyticsPlatform.value
        assert self.transaction_snuba_query.event_types == [
            SnubaQueryEventType.EventType.TRACE_ITEM_SPAN
        ]
        assert self.transaction_snuba_query.query == "(span.duration:>100) AND is_transaction:1"
        assert self.transaction_snuba_query.aggregate == "apdex(span.duration,300)"
        assert (
            self.transaction_snuba_query.extrapolation_mode
            == ExtrapolationMode.CLIENT_AND_SERVER_WEIGHTED.value
        )
        assert self.transaction_snuba_query.query_snapshot is not None
        new_transaction_query_subscription = QuerySubscription.objects.get(
            snuba_query=self.transaction_snuba_query
        )
        assert new_transaction_query_subscription.status == QuerySubscription.Status.ACTIVE.value

        # generic metrics alert
        assert self.generic_metric_snuba_query.dataset == Dataset.EventsAnalyticsPlatform.value
        assert self.generic_metric_snuba_query.event_types == [
            SnubaQueryEventType.EventType.TRACE_ITEM_SPAN
        ]
        assert self.generic_metric_snuba_query.query == "(is_transaction:1) AND is_transaction:1"
        assert self.generic_metric_snuba_query.aggregate == "count(span.duration)"
        assert (
            self.generic_metric_snuba_query.extrapolation_mode
            == ExtrapolationMode.SERVER_WEIGHTED.value
        )
        assert self.generic_metric_snuba_query.query_snapshot is not None
        new_generic_metric_query_subscription = QuerySubscription.objects.get(
            snuba_query=self.generic_metric_snuba_query
        )
        assert new_generic_metric_query_subscription.status == QuerySubscription.Status.ACTIVE.value

        # span alert (shouldn't change)
        assert self.span_snuba_query.dataset == Dataset.EventsAnalyticsPlatform.value
        assert self.span_snuba_query.event_types == [SnubaQueryEventType.EventType.TRACE_ITEM_SPAN]
        assert self.span_snuba_query.query == ""
        assert self.span_snuba_query.aggregate == "count_unique(span.op)"
        assert self.span_snuba_query.extrapolation_mode == ExtrapolationMode.UNKNOWN.value
        assert self.span_snuba_query.query_snapshot is None
        new_span_query_subscription = QuerySubscription.objects.get(
            snuba_query=self.span_snuba_query
        )
        assert self.span_query_subscription.id == new_span_query_subscription.id

        # inactive query subscription (shouldn't change)
        assert self.inactive_transaction_snuba_query.dataset == Dataset.Transactions.value
        assert self.inactive_transaction_snuba_query.event_types == [
            SnubaQueryEventType.EventType.TRANSACTION
        ]
        assert self.inactive_transaction_snuba_query.query == "transaction.duration:>100"
        assert self.inactive_transaction_snuba_query.aggregate == "apdex(300)"
        assert self.inactive_transaction_snuba_query.query_snapshot is None
        # no change in query subscription
        new_inactive_transaction_query_subscription = QuerySubscription.objects.get(
            snuba_query=self.inactive_transaction_snuba_query
        )
        assert (
            new_inactive_transaction_query_subscription.status
            == QuerySubscription.Status.DISABLED.value
        )

        # no data source (wrong type) (shouldn't change)
        assert self.wrong_subscription_type_snuba_query.dataset == Dataset.Transactions.value
        assert self.wrong_subscription_type_snuba_query.event_types == [
            SnubaQueryEventType.EventType.TRANSACTION
        ]
        assert self.wrong_subscription_type_snuba_query.query == "transaction.duration:>100"
        assert self.wrong_subscription_type_snuba_query.aggregate == "apdex(300)"
        assert self.wrong_subscription_type_snuba_query.query_snapshot is None
        # no change in query subscription
        new_wrong_subscription_type_query_subscription = QuerySubscription.objects.get(
            snuba_query=self.wrong_subscription_type_snuba_query
        )
        assert (
            new_wrong_subscription_type_query_subscription.status
            == QuerySubscription.Status.ACTIVE.value
        )

        # transaction anomaly detection alert (should work)
        assert (
            self.transaction_anomaly_detection_snuba_query.dataset
            == Dataset.EventsAnalyticsPlatform.value
        )
        assert self.transaction_anomaly_detection_snuba_query.event_types == [
            SnubaQueryEventType.EventType.TRACE_ITEM_SPAN
        ]
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
            snuba_query=self.transaction_anomaly_detection_snuba_query
        )
        assert (
            new_transaction_anomaly_detection_query_subscription.status
            == QuerySubscription.Status.ACTIVE.value
        )
