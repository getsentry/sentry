import datetime
from datetime import timezone

import pytest

from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics_performance import timeseries_query
from sentry.testutils.cases import MetricsEnhancedPerformanceTestCase
from sentry.testutils.skips import requires_snuba

pytestmark = [pytest.mark.sentry_metrics, requires_snuba]


@pytest.mark.snuba_ci
class TimeseriesQueryTest(MetricsEnhancedPerformanceTestCase):
    def setUp(self):
        super().setUp()
        # We want to always consider 7 days for simplicity.
        self.start = datetime.datetime.now(tz=timezone.utc).replace(
            hour=10, minute=0, second=0, microsecond=0
        ) - datetime.timedelta(days=1)
        self.end = datetime.datetime.now(tz=timezone.utc).replace(
            hour=10, minute=0, second=0, microsecond=0
        )
        self.default_interval = 3600
        self.projects = [self.project.id]
        self.params = {
            "organization_id": self.organization.id,
            "project_id": self.projects,
            "start": self.start,
            "end": self.end,
        }

        indexer.record(
            use_case_id=UseCaseID.TRANSACTIONS, org_id=self.organization.id, string="transaction"
        )

        for week in range(2):
            for hour in range(24):
                for j in range(2):
                    self.store_transaction_metric(
                        metric="transaction.duration",
                        tags={"transaction": "foo_transaction"},
                        # This formula gives us a different entry per hour, per insertion and per week.
                        value=(hour + j) * (week + 1),
                        timestamp=self.end
                        - datetime.timedelta(hours=hour)
                        - datetime.timedelta(weeks=week),
                    )

    def test_timeseries_query(self):
        results = timeseries_query(
            selected_columns=["avg(transaction.duration)"],
            query="",
            params=self.params,
            rollup=self.default_interval,
            referrer="test_query",
        )

        assert results.data["data"] == [
            {"time": 1697968800},
            {"avg_transaction_duration": 23.5, "time": 1697972400},
            {"avg_transaction_duration": 22.5, "time": 1697976000},
            {"avg_transaction_duration": 21.5, "time": 1697979600},
            {"avg_transaction_duration": 20.5, "time": 1697983200},
            {"avg_transaction_duration": 19.5, "time": 1697986800},
            {"avg_transaction_duration": 18.5, "time": 1697990400},
            {"avg_transaction_duration": 17.5, "time": 1697994000},
            {"avg_transaction_duration": 16.5, "time": 1697997600},
            {"avg_transaction_duration": 15.5, "time": 1698001200},
            {"avg_transaction_duration": 14.5, "time": 1698004800},
            {"avg_transaction_duration": 13.5, "time": 1698008400},
            {"avg_transaction_duration": 12.5, "time": 1698012000},
            {"avg_transaction_duration": 11.5, "time": 1698015600},
            {"avg_transaction_duration": 10.5, "time": 1698019200},
            {"avg_transaction_duration": 9.5, "time": 1698022800},
            {"avg_transaction_duration": 8.5, "time": 1698026400},
            {"avg_transaction_duration": 7.5, "time": 1698030000},
            {"avg_transaction_duration": 6.5, "time": 1698033600},
            {"avg_transaction_duration": 5.5, "time": 1698037200},
            {"avg_transaction_duration": 4.5, "time": 1698040800},
            {"avg_transaction_duration": 3.5, "time": 1698044400},
            {"avg_transaction_duration": 2.5, "time": 1698048000},
            {"avg_transaction_duration": 1.5, "time": 1698051600},
            {"time": 1698055200},
        ]

    def test_timeseries_query_with_comparison(self):
        results = timeseries_query(
            selected_columns=["avg(transaction.duration)"],
            query="",
            params=self.params,
            rollup=self.default_interval,
            comparison_delta=datetime.timedelta(weeks=1),
            referrer="test_query",
        )

        assert results.data["data"] == [
            {"time": 1697968800},
            {"avg_transaction_duration": 23.5, "comparisonCount": 47.0, "time": 1697972400},
            {"avg_transaction_duration": 22.5, "comparisonCount": 45.0, "time": 1697976000},
            {"avg_transaction_duration": 21.5, "comparisonCount": 43.0, "time": 1697979600},
            {"avg_transaction_duration": 20.5, "comparisonCount": 41.0, "time": 1697983200},
            {"avg_transaction_duration": 19.5, "comparisonCount": 39.0, "time": 1697986800},
            {"avg_transaction_duration": 18.5, "comparisonCount": 37.0, "time": 1697990400},
            {"avg_transaction_duration": 17.5, "comparisonCount": 35.0, "time": 1697994000},
            {"avg_transaction_duration": 16.5, "comparisonCount": 33.0, "time": 1697997600},
            {"avg_transaction_duration": 15.5, "comparisonCount": 31.0, "time": 1698001200},
            {"avg_transaction_duration": 14.5, "comparisonCount": 29.0, "time": 1698004800},
            {"avg_transaction_duration": 13.5, "comparisonCount": 27.0, "time": 1698008400},
            {"avg_transaction_duration": 12.5, "comparisonCount": 25.0, "time": 1698012000},
            {"avg_transaction_duration": 11.5, "comparisonCount": 23.0, "time": 1698015600},
            {"avg_transaction_duration": 10.5, "comparisonCount": 21.0, "time": 1698019200},
            {"avg_transaction_duration": 9.5, "comparisonCount": 19.0, "time": 1698022800},
            {"avg_transaction_duration": 8.5, "comparisonCount": 17.0, "time": 1698026400},
            {"avg_transaction_duration": 7.5, "comparisonCount": 15.0, "time": 1698030000},
            {"avg_transaction_duration": 6.5, "comparisonCount": 13.0, "time": 1698033600},
            {"avg_transaction_duration": 5.5, "comparisonCount": 11.0, "time": 1698037200},
            {"avg_transaction_duration": 4.5, "comparisonCount": 9.0, "time": 1698040800},
            {"avg_transaction_duration": 3.5, "comparisonCount": 7.0, "time": 1698044400},
            {"avg_transaction_duration": 2.5, "comparisonCount": 5.0, "time": 1698048000},
            {"avg_transaction_duration": 1.5, "comparisonCount": 3.0, "time": 1698051600},
            {"time": 1698055200},
        ]
