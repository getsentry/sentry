from unittest import TestCase
from unittest.mock import patch

from datadog.util.hostname import get_hostname

from sentry.metrics.datadog import DatadogMetricsBackend
from sentry.testutils import thread_leaks


class DatadogMetricsBackendTest(TestCase):
    def setUp(self):
        self.backend = DatadogMetricsBackend(prefix="sentrytest.")

    @thread_leaks.allowlist(issue=-1)
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

    @thread_leaks.allowlist(issue=-1)
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
    @thread_leaks.allowlist(issue=-1)
    def test_gauge(self, mock_gauge):
        self.backend.gauge("foo", 5, instance="bar")
        mock_gauge.assert_called_once_with(
            "sentrytest.foo",
            5,
            sample_rate=1,
            tags=["instance:bar"],
            host=get_hostname(hostname_from_config=True),
        )

    @patch("datadog.threadstats.base.ThreadStats.event")
    @thread_leaks.allowlist(issue=-1)
    def test_event(self, mock_event):
        self.backend.event("foo", "bar", instance="baz")
        mock_event.assert_called_once_with(
            title="foo",
            message="bar",
            alert_type=None,
            aggregation_key=None,
            source_type_name=None,
            priority=None,
            tags=["instance:baz"],
            hostname=get_hostname(hostname_from_config=True),
        )
