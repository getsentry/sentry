from typing import int
from unittest import TestCase
from unittest.mock import MagicMock, patch

from datadog.util.hostname import get_hostname

from sentry.metrics.datadog import DatadogMetricsBackend
from sentry.testutils.thread_leaks.pytest import thread_leak_allowlist


@thread_leak_allowlist(reason="datadog metrics", issue=97035)
class DatadogMetricsBackendTest(TestCase):
    def setUp(self) -> None:
        self.backend = DatadogMetricsBackend(prefix="sentrytest.")

    @patch("datadog.threadstats.base.ThreadStats.increment")
    def test_incr(self, mock_incr: MagicMock) -> None:
        self.backend.incr("foo", instance="bar")
        mock_incr.assert_called_once_with(
            "sentrytest.foo",
            1,
            sample_rate=1,
            tags=["instance:bar"],
            host=get_hostname(hostname_from_config=True),
        )

    @patch("datadog.threadstats.base.ThreadStats.timing")
    def test_timing(self, mock_timing: MagicMock) -> None:
        self.backend.timing("foo", 30, instance="bar")
        mock_timing.assert_called_once_with(
            "sentrytest.foo",
            30,
            sample_rate=1,
            tags=["instance:bar"],
            host=get_hostname(hostname_from_config=True),
        )

    @patch("datadog.threadstats.base.ThreadStats.gauge")
    def test_gauge(self, mock_gauge: MagicMock) -> None:
        self.backend.gauge("foo", 5, instance="bar")
        mock_gauge.assert_called_once_with(
            "sentrytest.foo",
            5,
            sample_rate=1,
            tags=["instance:bar"],
            host=get_hostname(hostname_from_config=True),
        )

    @patch("datadog.threadstats.base.ThreadStats.event")
    def test_event(self, mock_event: MagicMock) -> None:
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
