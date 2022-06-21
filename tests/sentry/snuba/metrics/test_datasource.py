from datetime import timedelta

from sentry.snuba.metrics.datasource import get_custom_measurements
from sentry.testutils.cases import MetricsEnhancedPerformanceTestCase
from sentry.testutils.helpers.datetime import before_now


class GetCustomMeasurementsTest(MetricsEnhancedPerformanceTestCase):
    METRIC_STRINGS = [
        "d:transactions/measurements.something_custom@millisecond",
        "d:transactions/measurements.something_else@byte",
    ]

    def setUp(self):
        super().setUp()
        self.day_ago = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)

    def test_simple(self):
        self.store_metric(
            1,
            metric="measurements.something_custom",
            internal_metric="d:transactions/measurements.something_custom@millisecond",
            entity="metrics_distributions",
            timestamp=self.day_ago + timedelta(hours=1, minutes=0),
        )
        result = get_custom_measurements(
            projects=[self.project], organization=self.organization, start=self.day_ago
        )
        assert result == [
            {
                "name": "measurements.something_custom",
                "type": "distribution",
                "operations": [
                    "avg",
                    "count",
                    "histogram",
                    "max",
                    "min",
                    "p50",
                    "p75",
                    "p90",
                    "p95",
                    "p99",
                ],
                "unit": "millisecond",
            }
        ]

    def test_metric_outside_query_daterange(self):
        self.store_metric(
            1,
            metric="measurements.something_custom",
            internal_metric="d:transactions/measurements.something_custom@millisecond",
            entity="metrics_distributions",
            timestamp=self.day_ago + timedelta(hours=1, minutes=0),
        )
        # Shouldn't show up
        self.store_metric(
            1,
            metric="measurements.something_else",
            internal_metric="d:transactions/measurements.something_else@byte",
            entity="metrics_distributions",
            timestamp=self.day_ago - timedelta(days=1, minutes=0),
        )
        result = get_custom_measurements(
            projects=[self.project], organization=self.organization, start=self.day_ago
        )
        assert result == [
            {
                "name": "measurements.something_custom",
                "type": "distribution",
                "operations": [
                    "avg",
                    "count",
                    "histogram",
                    "max",
                    "min",
                    "p50",
                    "p75",
                    "p90",
                    "p95",
                    "p99",
                ],
                "unit": "millisecond",
            }
        ]
