from unittest.mock import patch

from datadog.util.hostname import get_hostname

from sentry.metrics.datadog import DatadogMetricsBackend
from sentry.testutils.cases import TestCase


class DatadogMetricsBackendTest(TestCase):
    def setUp(self):
        self.backend = DatadogMetricsBackend(prefix="sentrytest.")

    @patch("datadog.threadstats.base.ThreadStats.increment")
    def test_incr(self, mock_incr):
        self.backend.incr("foo", instance="bar")
        mock_incr.assert_called_once_with(
            "sentrytest.foo",
            1,
            sample_rate=1,
            tags=["instance:bar"],
            host=get_hostname(hostname_from_config=True),
        )

    @patch("datadog.threadstats.base.ThreadStats.timing")
    def test_timing(self, mock_timing):
        self.backend.timing("foo", 30, instance="bar")
        mock_timing.assert_called_once_with(
            "sentrytest.foo",
            30,
            sample_rate=1,
            tags=["instance:bar"],
            host=get_hostname(hostname_from_config=True),
        )

    @patch("datadog.threadstats.base.ThreadStats.gauge")
    def test_gauge(self, mock_gauge):
        self.backend.gauge("foo", 5, instance="bar")
        mock_gauge.assert_called_once_with(
            "sentrytest.foo",
            5,
            sample_rate=1,
            tags=["instance:bar"],
            host=get_hostname(hostname_from_config=True),
        )
