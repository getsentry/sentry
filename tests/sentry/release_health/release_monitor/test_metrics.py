from sentry.release_health.release_monitor.metrics import MetricReleaseMonitorBackend
from sentry.testutils import SessionMetricsTestCase, TestCase
from tests.sentry.release_health.release_monitor import (
    BaseFetchProjectReleaseHealthTotalsTest,
    BaseFetchProjectsWithRecentSessionsTest,
)


class MetricFetchProjectsWithRecentSessionsTest(
    BaseFetchProjectsWithRecentSessionsTest, TestCase, SessionMetricsTestCase
):
    backend_class = MetricReleaseMonitorBackend


class SessionFetchProjectReleaseHealthTotalsTest(
    BaseFetchProjectReleaseHealthTotalsTest, TestCase, SessionMetricsTestCase
):
    backend_class = MetricReleaseMonitorBackend
