from unittest.mock import patch

import pytest

from sentry.metrics.minimetrics import MiniMetricsMetricsBackend
from sentry.testutils.cases import TestCase


class MiniMetricsMetricsBackendTest(TestCase):
    def setUp(self):
        self.backend = MiniMetricsMetricsBackend(prefix="sentrytest.")

    @patch("sentry.metrics.minimetrics.Aggregator.ROLLUP_IN_SECONDS", 1.0)
    @patch("sentry.metrics.minimetrics.metrics.incr")
    def test_incr_called_with_no_tags(self, metrics_incr):
        self.backend.incr(key="foo")
        self.backend.client.aggregator.stop()

        assert len(self.backend.client.aggregator.buckets) == 0
        assert metrics_incr.call_count == 3

    @patch("sentry.metrics.minimetrics.Aggregator.ROLLUP_IN_SECONDS", 1.0)
    @patch("sentry.metrics.minimetrics.metrics.incr")
    def test_incr_called_with_tag_value_as_list(self, metrics_incr):
        # The minimetrics backend supports the list type.
        self.backend.incr(key="foo", tags={"foo": ["bar", "baz"]})  # type:ignore
        self.backend.client.aggregator.stop()

        assert len(self.backend.client.aggregator.buckets) == 0
        assert metrics_incr.call_count == 3

    @patch("sentry.metrics.minimetrics.Aggregator.ROLLUP_IN_SECONDS", 1.0)
    @patch("sentry.metrics.minimetrics.metrics.incr")
    def test_incr_not_called_after_flusher_stopped(self, metrics_incr):
        self.backend.client.aggregator.stop()
        self.backend.incr(key="foo")

        assert len(self.backend.client.aggregator.buckets) == 0
        assert metrics_incr.call_count == 0

    def test_stop_called_twice(self):
        self.backend.client.aggregator.stop()
        with pytest.raises(AssertionError):
            self.backend.client.aggregator.stop()
