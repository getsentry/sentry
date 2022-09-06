from sentry.release_health.release_monitor.sessions import SessionReleaseMonitorBackend
from sentry.testutils import SnubaTestCase, TestCase
from sentry.testutils.silo import customer_silo_test
from tests.sentry.release_health.release_monitor import (
    BaseFetchProjectReleaseHealthTotalsTest,
    BaseFetchProjectsWithRecentSessionsTest,
)


class SessionFetchProjectsWithRecentSessionsTest(
    BaseFetchProjectsWithRecentSessionsTest, TestCase, SnubaTestCase
):
    backend_class = SessionReleaseMonitorBackend


@customer_silo_test
class SessionFetchProjectReleaseHealthTotalsTest(
    BaseFetchProjectReleaseHealthTotalsTest, TestCase, SnubaTestCase
):
    backend_class = SessionReleaseMonitorBackend
