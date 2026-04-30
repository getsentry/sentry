from datetime import timedelta
from unittest.mock import patch

import pytest

from sentry.explore.translation.am1_metrics_to_transactions import (
    rollback_am1_metrics_detector_query_and_update_subscription_in_snuba,
    snapshot_snuba_query,
    translate_am1_metrics_detector_and_update_subscription_in_snuba,
)
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import (
    QuerySubscription,
    SnubaQuery,
    SnubaQueryEventType,
)
from sentry.snuba.subscriptions import create_snuba_query
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.features import with_feature

pytestmark = pytest.mark.sentry_metrics


class AM1MetricsToTransactionsTestCase(TestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.org = self.create_organization()
        self.project = self.create_project(organization=self.org)

    def _create_snuba_query(
        self,
        dataset: Dataset = Dataset.PerformanceMetrics,
        query: str = "event.type:transaction",
        aggregate: str = "count()",
    ) -> SnubaQuery:
        return create_snuba_query(
            query_type=SnubaQuery.Type.PERFORMANCE,
            dataset=dataset,
            query=query,
            aggregate=aggregate,
            time_window=timedelta(minutes=10),
            environment=None,
            event_types=[SnubaQueryEventType.EventType.TRANSACTION],
            resolution=timedelta(minutes=1),
        )

    def _setup_detector(self, snuba_query: SnubaQuery):
        """Creates a QuerySubscription, DataSource, and Detector linked to the given snuba_query."""
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
        detector = self.create_detector(
            name="Test Detector",
            type=MetricIssue.slug,
            project=self.project,
            config={"detection_type": AlertRuleDetectionType.STATIC.value},
            workflow_condition_group=self.create_data_condition_group(organization=self.org),
        )
        data_source.detectors.add(detector)
        return query_subscription, data_source, detector


class SnapshotSnubaQueryTest(AM1MetricsToTransactionsTestCase):
    def test_snapshot_snuba_query_with_performance_metrics(self) -> None:
        snuba_query = self._create_snuba_query(dataset=Dataset.PerformanceMetrics)

        snapshot_snuba_query(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.query_snapshot is not None
        assert snuba_query.query_snapshot["metrics_to_transactions"] is True

    def test_snapshot_snuba_query_skips_non_performance_metrics_dataset(self) -> None:
        snuba_query = self._create_snuba_query(dataset=Dataset.Transactions)

        snapshot_snuba_query(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.query_snapshot is None

    def test_snapshot_snuba_query_does_not_overwrite_existing_snapshot(self) -> None:
        snuba_query = self._create_snuba_query(dataset=Dataset.PerformanceMetrics)

        snapshot_snuba_query(snuba_query)
        snuba_query.refresh_from_db()
        first_snapshot = snuba_query.query_snapshot

        # Modify the query and call again — snapshot should not change
        snuba_query.query = "transaction.duration:>999"
        snapshot_snuba_query(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.query_snapshot == first_snapshot


class TranslateAM1MetricsDetectorTest(AM1MetricsToTransactionsTestCase):
    @with_feature("organizations:migrate-am1-metrics-alerts-to-transactions")
    @patch("sentry.snuba.tasks._create_snql_in_snuba")
    def test_translate_migrates_performance_metrics_to_transactions(self, mock_create_snql) -> None:
        mock_create_snql.return_value = "test-subscription-id"
        snuba_query = self._create_snuba_query()
        self._setup_detector(snuba_query)

        with self.tasks():
            translate_am1_metrics_detector_and_update_subscription_in_snuba(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.dataset == Dataset.Transactions.value
        assert snuba_query.query_snapshot is not None
        assert snuba_query.query_snapshot["metrics_to_transactions"] is True

        assert mock_create_snql.called

    @with_feature("organizations:migrate-am1-metrics-alerts-to-transactions")
    def test_translate_returns_early_without_active_subscription(self) -> None:
        snuba_query = self._create_snuba_query()
        # No QuerySubscription created

        translate_am1_metrics_detector_and_update_subscription_in_snuba(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.dataset == Dataset.PerformanceMetrics.value
        assert snuba_query.query_snapshot is None

    @with_feature("organizations:migrate-am1-metrics-alerts-to-transactions")
    def test_translate_returns_early_without_data_source(self) -> None:
        snuba_query = self._create_snuba_query()
        QuerySubscription.objects.create(
            project=self.project,
            type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
            snuba_query=snuba_query,
            status=QuerySubscription.Status.ACTIVE.value,
        )
        # No DataSource created

        translate_am1_metrics_detector_and_update_subscription_in_snuba(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.dataset == Dataset.PerformanceMetrics.value
        assert snuba_query.query_snapshot is None

    def test_translate_returns_early_without_feature_flag(self) -> None:
        snuba_query = self._create_snuba_query()
        self._setup_detector(snuba_query)

        translate_am1_metrics_detector_and_update_subscription_in_snuba(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.dataset == Dataset.PerformanceMetrics.value
        assert snuba_query.query_snapshot is None

    @with_feature("organizations:migrate-am1-metrics-alerts-to-transactions")
    def test_translate_skips_migration_for_user_updated_query(self) -> None:
        snuba_query = self._create_snuba_query()
        snuba_query.query_snapshot = {"metrics_to_transactions": True, "user_updated": True}
        snuba_query.save()
        self._setup_detector(snuba_query)

        translate_am1_metrics_detector_and_update_subscription_in_snuba(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.dataset == Dataset.PerformanceMetrics.value


class RollbackAM1MetricsDetectorTest(AM1MetricsToTransactionsTestCase):
    @with_feature("organizations:migrate-am1-metrics-alerts-to-transactions")
    @patch("sentry.snuba.tasks._delete_from_snuba")
    @patch("sentry.snuba.tasks._create_snql_in_snuba")
    def test_rollback_restores_original_dataset(self, mock_create_snql, mock_delete) -> None:
        mock_create_snql.return_value = "test-subscription-id"
        mock_delete.return_value = None

        snuba_query = self._create_snuba_query()
        original_dataset = snuba_query.dataset
        original_query = snuba_query.query
        original_aggregate = snuba_query.aggregate
        self._setup_detector(snuba_query)

        with self.tasks():
            translate_am1_metrics_detector_and_update_subscription_in_snuba(snuba_query)
        snuba_query.refresh_from_db()
        assert snuba_query.dataset == Dataset.Transactions.value

        with self.tasks():
            rollback_am1_metrics_detector_query_and_update_subscription_in_snuba(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.dataset == original_dataset
        assert snuba_query.query == original_query
        assert snuba_query.aggregate == original_aggregate

    @with_feature("organizations:migrate-am1-metrics-alerts-to-transactions")
    def test_rollback_returns_early_without_snapshot(self) -> None:
        snuba_query = self._create_snuba_query(dataset=Dataset.Transactions)
        self._setup_detector(snuba_query)
        # No translate call, so no snapshot exists

        rollback_am1_metrics_detector_query_and_update_subscription_in_snuba(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.dataset == Dataset.Transactions.value

    def test_rollback_returns_early_without_feature_flag(self) -> None:
        snuba_query = self._create_snuba_query(dataset=Dataset.Transactions)
        self._setup_detector(snuba_query)

        rollback_am1_metrics_detector_query_and_update_subscription_in_snuba(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.dataset == Dataset.Transactions.value

    @with_feature("organizations:migrate-am1-metrics-alerts-to-transactions")
    def test_rollback_returns_early_without_active_subscription(self) -> None:
        snuba_query = self._create_snuba_query(dataset=Dataset.Transactions)
        # No QuerySubscription created

        rollback_am1_metrics_detector_query_and_update_subscription_in_snuba(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.dataset == Dataset.Transactions.value

    @with_feature("organizations:migrate-am1-metrics-alerts-to-transactions")
    def test_rollback_returns_early_if_snapshot_has_no_am1_metrics_flag(self) -> None:
        snuba_query = self._create_snuba_query(dataset=Dataset.Transactions)
        # Snapshot exists but lacks the metrics_to_transactions marker
        snuba_query.query_snapshot = {"some_other_migration": True}
        snuba_query.save()
        self._setup_detector(snuba_query)

        rollback_am1_metrics_detector_query_and_update_subscription_in_snuba(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.dataset == Dataset.Transactions.value

    @with_feature("organizations:migrate-am1-metrics-alerts-to-transactions")
    def test_rollback_skips_for_user_updated_query(self) -> None:
        snuba_query = self._create_snuba_query(dataset=Dataset.Transactions)
        snuba_query.query_snapshot = {"metrics_to_transactions": True, "user_updated": True}
        snuba_query.save()
        self._setup_detector(snuba_query)

        rollback_am1_metrics_detector_query_and_update_subscription_in_snuba(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.dataset == Dataset.Transactions.value

    @with_feature("organizations:migrate-am1-metrics-alerts-to-transactions")
    def test_rollback_returns_early_if_already_on_performance_metrics(self) -> None:
        snuba_query = self._create_snuba_query(dataset=Dataset.PerformanceMetrics)
        snuba_query.query_snapshot = {"metrics_to_transactions": True}
        snuba_query.save()
        self._setup_detector(snuba_query)

        rollback_am1_metrics_detector_query_and_update_subscription_in_snuba(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.dataset == Dataset.PerformanceMetrics.value

    @with_feature("organizations:migrate-am1-metrics-alerts-to-transactions")
    def test_rollback_returns_early_if_dataset_is_not_transactions(self) -> None:
        # Create with Transactions then manually switch to a third dataset to simulate
        # a query in an unexpected state
        snuba_query = self._create_snuba_query(dataset=Dataset.EventsAnalyticsPlatform)
        snuba_query.query_snapshot = {"metrics_to_transactions": True}
        snuba_query.save()
        self._setup_detector(snuba_query)

        rollback_am1_metrics_detector_query_and_update_subscription_in_snuba(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.dataset == Dataset.EventsAnalyticsPlatform.value
