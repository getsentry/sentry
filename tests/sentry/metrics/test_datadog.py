from __future__ import absolute_import

from sentry.utils.compat.mock import patch

from datadog.util.hostname import get_hostname

from sentry.metrics.datadog import DatadogMetricsBackend
from sentry.testutils import TestCase


class DatadogMetricsBackendTest(TestCase):
    def setUp(self):
        self.backend = DatadogMetricsBackend(prefix="sentrytest.")

    @patch("datadog.threadstats.base.ThreadStats.increment")
    def test_incr(self, mock_incr):
        self.backend.incr("foo", instance="bar")
        mock_incr.assert_called_once_with(
            "sentrytest.foo", 1, sample_rate=1, tags=["instance:bar"], host=get_hostname()
        )

    @patch("datadog.threadstats.base.ThreadStats.timing")
    def test_timing(self, mock_timing):
        self.backend.timing("foo", 30, instance="bar")
        mock_timing.assert_called_once_with(
            "sentrytest.foo", 30, sample_rate=1, tags=["instance:bar"], host=get_hostname()
        )
