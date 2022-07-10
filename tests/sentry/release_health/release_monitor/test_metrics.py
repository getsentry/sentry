from sentry.release_health.release_monitor.metrics import MetricReleaseMonitorBackend
from sentry.testutils import SessionMetricsTestCase, TestCase
from tests.sentry.release_health.release_monitor import (
    FetchProjectReleaseHealthTotalsTestBase,
    FetchProjectsWithRecentSessionsTestBase,
)


class MetricFetchProjectsWithRecentSessionsTest(
    FetchProjectsWithRecentSessionsTestBase, TestCase, SessionMetricsTestCase
):
    backend_class = MetricReleaseMonitorBackend


class SessionFetchProjectReleaseHealthTotalsTest(
    FetchProjectReleaseHealthTotalsTestBase, TestCase, SessionMetricsTestCase
):
    backend_class = MetricReleaseMonitorBackend
