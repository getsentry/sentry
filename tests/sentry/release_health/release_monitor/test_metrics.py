from sentry.release_health.release_monitor.metrics import MetricReleaseMonitorBackend
from sentry.testutils import BaseMetricsTestCase, SessionMetricsReleaseHealthTestCase, TestCase
from tests.sentry.release_health.release_monitor import (
    BaseFetchProjectReleaseHealthTotalsTest,
    BaseFetchProjectsWithRecentSessionsTest,
)


class MetricFetchProjectsWithRecentSessionsTest(
    BaseFetchProjectsWithRecentSessionsTest, TestCase, BaseMetricsTestCase
):
    backend_class = MetricReleaseMonitorBackend


class SessionFetchProjectReleaseHealthTotalsTest(
    BaseFetchProjectReleaseHealthTotalsTest, TestCase, SessionMetricsReleaseHealthTestCase
):
    backend_class = MetricReleaseMonitorBackend
