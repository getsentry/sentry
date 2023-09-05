import time
from unittest.mock import patch

from sentry.metrics.minimetrics import MiniMetricsMetricsBackend
from sentry.testutils.cases import TestCase


class DatadogMetricsBackendTest(TestCase):
    def setUp(self):
        self.backend = MiniMetricsMetricsBackend(prefix="sentrytest.")

    @patch("sentry.metrics.minimetrics.Aggregator.ROLLUP_IN_SECONDS", 1.0)
    @patch("sentry.metrics.minimetrics.metrics.incr")
    def test_incr(self, metrics_incr):
        self.backend.incr("foo", instance="bar")
        # We wait for the metric to be flushed.
        time.sleep(2.0)
        # We stop the flusher.
        self.backend._client.aggregator._running = False
        self.backend._client.aggregator._flusher.join()
        metrics_incr.assert_called_once()

    @patch("sentry.metrics.minimetrics.Aggregator.ROLLUP_IN_SECONDS", 1.0)
    @patch("sentry.metrics.minimetrics.metrics.incr")
    def test_incr_bad(self, metrics_incr):
        # The backend supports this type.
        self.backend.incr("foo", instance="bar", tags={"foo": ["bar"]})  # type:ignore
        # We wait for the metric to be flushed.
        time.sleep(2.0)
        # We stop the flusher.
        self.backend._client.aggregator._running = False
        self.backend._client.aggregator._flusher.join()
        metrics_incr.assert_called_once()
