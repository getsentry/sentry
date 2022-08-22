from sentry.release_health.release_monitor.sessions import SessionReleaseMonitorBackend
from sentry.testutils import SnubaTestCase, TestCase
from tests.sentry.release_health.release_monitor import (
    BaseFetchProjectReleaseHealthTotalsTest,
    BaseFetchProjectsWithRecentSessionsTest,
)


class SessionFetchProjectsWithRecentSessionsTest(
    BaseFetchProjectsWithRecentSessionsTest, TestCase, SnubaTestCase
):
    backend_class = SessionReleaseMonitorBackend


class SessionFetchProjectReleaseHealthTotalsTest(
    BaseFetchProjectReleaseHealthTotalsTest, TestCase, SnubaTestCase
):
    backend_class = SessionReleaseMonitorBackend
