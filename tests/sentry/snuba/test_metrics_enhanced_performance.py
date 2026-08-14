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
    def setUp(self) -> None:
        super().setUp()
        self.snuba_params = SnubaParams(
            organization=self.organization,
            projects=[self.project],
            start=before_now(days=1),
            end=self.now,
        )

    @cached_property
    def now(self):
        return before_now()

    @mock.patch("sentry.snuba.metrics_enhanced_performance.metrics_query")
    @mock.patch("sentry.snuba.transactions.query")
    def test_skips_generic_metrics_and_uses_transactions_when_flagged(
        self, mock_transactions_query, mock_metrics_query
    ):
        transaction_data = load_data("transaction", timestamp=before_now(days=1))
        self.store_event(transaction_data, self.project.id)

        metrics_enhanced_performance.query(
            selected_columns=[
                "transaction",
                "count()",
            ],
            query="",
            snuba_params=self.snuba_params,
            referrer="test_query",
            auto_fields=True,
            fallback_to_transactions=True,
        )

        mock_metrics_query.assert_not_called()
        mock_transactions_query.assert_called_once()

    @mock.patch("sentry.snuba.metrics_enhanced_performance.metrics_query")
    @mock.patch("sentry.snuba.discover.query")
    def test_skips_generic_metrics_and_uses_discover_when_not_flagged(
        self, mock_discover_query, mock_metrics_query
    ):
        transaction_data = load_data("transaction", timestamp=before_now(days=1))
        self.store_event(transaction_data, self.project.id)

        metrics_enhanced_performance.query(
            selected_columns=[
                "transaction",
                "count()",
            ],
            query="",
            snuba_params=self.snuba_params,
            referrer="test_query",
            auto_fields=True,
            fallback_to_transactions=False,
        )

        mock_metrics_query.assert_not_called()
        mock_discover_query.assert_called_once()

    @mock.patch("sentry.snuba.metrics_enhanced_performance.metrics_query")
    def test_still_uses_metrics_for_on_demand(self, mock_metrics_query):
        mock_metrics_query.return_value = {
            "data": [],
            "meta": {"fields": {}, "isMetricsData": True},
        }

        metrics_enhanced_performance.query(
            selected_columns=["count()"],
            query="",
            snuba_params=self.snuba_params,
            referrer="test_query",
            on_demand_metrics_enabled=True,
        )

        mock_metrics_query.assert_called_once()
