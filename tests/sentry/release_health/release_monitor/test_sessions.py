from sentry.release_health.release_monitor.sessions import SessionReleaseMonitorBackend
from sentry.testutils.silo import region_silo_test
from tests.sentry.release_health.release_monitor import (
    BaseFetchProjectReleaseHealthTotalsTest,
    BaseFetchProjectsWithRecentSessionsTest,
)


@region_silo_test
class SessionFetchProjectsWithRecentSessionsTest(BaseFetchProjectsWithRecentSessionsTest):
    backend_class = SessionReleaseMonitorBackend


@region_silo_test
class SessionFetchProjectReleaseHealthTotalsTest(BaseFetchProjectReleaseHealthTotalsTest):
    backend_class = SessionReleaseMonitorBackend
