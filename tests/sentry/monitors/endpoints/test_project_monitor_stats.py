from sentry.testutils.silo import region_silo_test
from tests.sentry.monitors.endpoints.test_base import BaseProjectMonitorTest
from tests.sentry.monitors.endpoints.test_base_monitor_stats import BaseMonitorStatsTest


@region_silo_test
class ProjectMonitorStatsTest(BaseMonitorStatsTest, BaseProjectMonitorTest):
    endpoint = "sentry-api-0-project-monitor-stats"
    __test__ = True
