from tests.sentry.monitors.endpoints.test_base import BaseProjectMonitorTest
from tests.sentry.monitors.endpoints.test_base_monitor_stats import BaseMonitorStatsTest


class ProjectMonitorStatsTest(BaseMonitorStatsTest, BaseProjectMonitorTest):
    endpoint = "sentry-api-0-project-monitor-stats"
    __test__ = True
