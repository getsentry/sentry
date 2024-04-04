from tests.sentry.monitors.endpoints.test_base_monitor_stats import BaseMonitorStatsTest


class OrganizationMonitorStatsTest(BaseMonitorStatsTest):
    endpoint = "sentry-api-0-organization-monitor-stats"
    __test__ = True
