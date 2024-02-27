from sentry.testutils.silo import region_silo_test
from tests.sentry.monitors.endpoints.test_base_monitor_stats import BaseMonitorStatsTest


@region_silo_test
class OrganizationMonitorStatsTest(BaseMonitorStatsTest):
    endpoint = "sentry-api-0-organization-monitor-stats"
    __test__ = True
