from __future__ import absolute_import

from mock import patch

from sentry.metrics.datadog import DatadogMetricsBackend
from sentry.testutils import TestCase


class DatadogMetricsBackendTest(TestCase):
    def setUp(self):
        self.backend = DatadogMetricsBackend(prefix='sentrytest.')

    @patch('datadog.threadstats.base.ThreadStats.increment')
    def test_incr(self, mock_incr):
        self.backend.incr('foo')
        mock_incr.assert_called_once_with('sentrytest.foo', 1, sample_rate=1)

    @patch('datadog.threadstats.base.ThreadStats.timing')
    def test_timing(self, mock_timing):
        self.backend.timing('foo', 30)
        mock_timing.assert_called_once_with('sentrytest.foo', 30, sample_rate=1)
