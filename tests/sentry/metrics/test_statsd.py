from __future__ import absolute_import

from mock import patch

from sentry.metrics.statsd import StatsdMetricsBackend
from sentry.testutils import TestCase


class StatsdMetricsBackendTest(TestCase):
    def setUp(self):
        self.backend = StatsdMetricsBackend(prefix='sentrytest.')

    @patch('statsd.StatsClient.incr')
    def test_incr(self, mock_incr):
        self.backend.incr('foo')
        mock_incr.assert_called_once_with('sentrytest.foo', 1, 1)

    @patch('statsd.StatsClient.timing')
    def test_timing(self, mock_timing):
        self.backend.timing('foo', 30)
        mock_timing.assert_called_once_with('sentrytest.foo', 30, 1)
