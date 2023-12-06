import datetime
from datetime import timezone

import pytest

from sentry.exceptions import IncompatibleMetricsQuery
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

        expected = [
            None,
            23.5,
            22.5,
            21.5,
            20.5,
            19.5,
            18.5,
            17.5,
            16.5,
            15.5,
            14.5,
            13.5,
            12.5,
            11.5,
            10.5,
            9.5,
            8.5,
            7.5,
            6.5,
            5.5,
            4.5,
            3.5,
            2.5,
            1.5,
            None,
        ]
        for index, data in enumerate(results.data["data"]):
            assert data.get("avg_transaction_duration") == expected[index]

    def test_timeseries_query_with_comparison(self):
        results = timeseries_query(
            selected_columns=["avg(transaction.duration)"],
            query="",
            params=self.params,
            rollup=self.default_interval,
            comparison_delta=datetime.timedelta(weeks=1),
            referrer="test_query",
        )

        expected = [
            None,
            23.5,
            22.5,
            21.5,
            20.5,
            19.5,
            18.5,
            17.5,
            16.5,
            15.5,
            14.5,
            13.5,
            12.5,
            11.5,
            10.5,
            9.5,
            8.5,
            7.5,
            6.5,
            5.5,
            4.5,
            3.5,
            2.5,
            1.5,
            None,
        ]
        expected_comparison = [
            None,
            47.0,
            45.0,
            43.0,
            41.0,
            39.0,
            37.0,
            35.0,
            33.0,
            31.0,
            29.0,
            27.0,
            25.0,
            23.0,
            21.0,
            19.0,
            17.0,
            15.0,
            13.0,
            11.0,
            9.0,
            7.0,
            5.0,
            3.0,
            None,
        ]
        for index, data in enumerate(results.data["data"]):
            assert data.get("avg_transaction_duration") == expected[index]
            assert data.get("comparisonCount") == expected_comparison[index]

    def test_timeseries_query_with_comparison_and_multiple_aggregates(self):
        with pytest.raises(
            IncompatibleMetricsQuery,
            match="The comparison query for metrics supports only one aggregate.",
        ):
            timeseries_query(
                selected_columns=["avg(transaction.duration)", "sum(transaction.duration)"],
                query="",
                params=self.params,
                rollup=self.default_interval,
                comparison_delta=datetime.timedelta(weeks=1),
                referrer="test_query",
            )
