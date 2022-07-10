from sentry.release_health.release_monitor.sessions import SessionReleaseMonitorBackend
from sentry.testutils import SnubaTestCase, TestCase
from tests.sentry.release_health.release_monitor import (
    FetchProjectReleaseHealthTotalsTestBase,
    FetchProjectsWithRecentSessionsTestBase,
)


class SessionFetchProjectsWithRecentSessionsTest(
    FetchProjectsWithRecentSessionsTestBase, TestCase, SnubaTestCase
):
    backend_class = SessionReleaseMonitorBackend


class SessionFetchProjectReleaseHealthTotalsTest(
    FetchProjectReleaseHealthTotalsTestBase, TestCase, SnubaTestCase
):
    backend_class = SessionReleaseMonitorBackend
