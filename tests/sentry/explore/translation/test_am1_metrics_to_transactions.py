from datetime import timedelta

import pytest

from sentry.explore.translation.am1_metrics_to_transactions import (
    rollback_am1_metrics_detector_query_and_update_subscription_in_snuba,
    snapshot_snuba_query,
)
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import QuerySubscription, SnubaQuery, SnubaQueryEventType
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
        dataset: Dataset = Dataset.Transactions,
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
    def test_snapshot_snuba_query_skips_non_performance_metrics_dataset(self) -> None:
        snuba_query = self._create_snuba_query(dataset=Dataset.Transactions)

        snapshot_snuba_query(snuba_query)
        snuba_query.refresh_from_db()

        assert snuba_query.query_snapshot is None


class RollbackAM1MetricsDetectorTest(AM1MetricsToTransactionsTestCase):
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
