from unittest.mock import patch

from sentry.metrics.minimetrics import MiniMetricsMetricsBackend
from sentry.testutils.cases import TestCase


class DatadogMetricsBackendTest(TestCase):
    def setUp(self):
        self.backend = MiniMetricsMetricsBackend(prefix="sentrytest.")

    @patch("sentry.metrics.minimetrics.Aggregator.ROLLUP_IN_SECONDS", 1.0)
    @patch("sentry.metrics.minimetrics.metrics.incr")
    def test_incr_with_no_tags(self, metrics_incr):
        self.backend.incr("foo", instance="bar")
        self.backend.client.aggregator.stop()

        assert len(self.backend.client.aggregator.buckets) == 0
        assert metrics_incr.call_count == 3

    @patch("sentry.metrics.minimetrics.Aggregator.ROLLUP_IN_SECONDS", 1.0)
    @patch("sentry.metrics.minimetrics.metrics.incr")
    def test_incr_with_tag_value_as_list(self, metrics_incr):
        # The minimetrics backend supports the list type.
        self.backend.incr("foo", instance="bar", tags={"foo": ["bar", "baz"]})  # type:ignore
        self.backend.client.aggregator.stop()

        assert len(self.backend.client.aggregator.buckets) == 0
        assert metrics_incr.call_count == 3
