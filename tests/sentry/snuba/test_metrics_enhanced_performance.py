from datetime import timedelta
from functools import cached_property
from unittest import mock

import pytest
from django.utils import timezone

from sentry.search.events.types import SnubaParams
from sentry.snuba import metrics_enhanced_performance
from sentry.testutils.cases import MetricsEnhancedPerformanceTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.utils.samples import load_data

pytestmark = pytest.mark.sentry_metrics

MOCK_DATETIME = (timezone.now() - timedelta(days=1)).replace(
    hour=0, minute=0, second=0, microsecond=0
)


@freeze_time(MOCK_DATETIME)
class MetricsEnhancedPerformanceTest(MetricsEnhancedPerformanceTestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.snuba_params = SnubaParams(
            organization=self.organization.id,
            projects=[self.project],
            start=before_now(days=1),
            end=self.now,
        )

    @cached_property
    def now(self):
        return before_now()

    @mock.patch("sentry.snuba.transactions.query")
    def test_metrics_incompatible_query_redirects_to_transactions_when_flagged(
        self, mock_transactions_query
    ):
        self.store_transaction_metric(
            33,
            metric="measurements.datacenter_memory",
            internal_metric="d:transactions/measurements.datacenter_memory@petabyte",
            entity="metrics_distributions",
            tags={"transaction": "foo_transaction"},
            timestamp=before_now(days=1),
        )
        transaction_data = load_data("transaction", timestamp=before_now(days=1))
        transaction_data["measurements"]["datacenter_memory"] = {
            "value": 33,
            "unit": "petabyte",
        }
        self.store_event(transaction_data, self.project.id)

        metrics_enhanced_performance.query(
            selected_columns=[
                "transaction",
                "measurements.datacenter_memory",
            ],
            # Equations are not compatible with metrics in MEP, forces a fallback
            equations=["measurements.datacenter_memory / 3"],
            query="",
            snuba_params=self.snuba_params,
            referrer="test_query",
            auto_fields=True,
            fallback_to_transactions=True,
        )

        mock_transactions_query.assert_called_once()

    @mock.patch("sentry.snuba.discover.query")
    def test_metrics_incompatible_query_redirects_to_discover_when_not_flagged(
        self, mock_discover_query
    ):
        self.store_transaction_metric(
            33,
            metric="measurements.datacenter_memory",
            internal_metric="d:transactions/measurements.datacenter_memory@petabyte",
            entity="metrics_distributions",
            tags={"transaction": "foo_transaction"},
            timestamp=before_now(days=1),
        )
        transaction_data = load_data("transaction", timestamp=before_now(days=1))
        transaction_data["measurements"]["datacenter_memory"] = {
            "value": 33,
            "unit": "petabyte",
        }
        self.store_event(transaction_data, self.project.id)

        metrics_enhanced_performance.query(
            selected_columns=[
                "transaction",
                "measurements.datacenter_memory",
            ],
            # Equations are not compatible with metrics in MEP, forces a fallback
            equations=["measurements.datacenter_memory / 3"],
            query="",
            snuba_params=self.snuba_params,
            referrer="test_query",
            auto_fields=True,
            fallback_to_transactions=False,
        )

        mock_discover_query.assert_called_once()
