from sentry.release_health.release_monitor.sessions import SessionReleaseMonitorBackend
from tests.sentry.release_health.release_monitor import (
    BaseFetchProjectReleaseHealthTotalsTest,
    BaseFetchProjectsWithRecentSessionsTest,
)


class SessionFetchProjectsWithRecentSessionsTest(BaseFetchProjectsWithRecentSessionsTest):
    backend_class = SessionReleaseMonitorBackend


class SessionFetchProjectReleaseHealthTotalsTest(BaseFetchProjectReleaseHealthTotalsTest):
    backend_class = SessionReleaseMonitorBackend
