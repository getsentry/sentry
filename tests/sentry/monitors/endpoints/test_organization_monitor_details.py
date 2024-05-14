from tests.sentry.monitors.endpoints.test_base_monitor_details import (
    BaseDeleteMonitorTest,
    BaseMonitorDetailsTest,
    BaseUpdateMonitorTest,
)


class OrganizationMonitorDetailsTest(BaseMonitorDetailsTest):
    endpoint = "sentry-api-0-organization-monitor-details"
    __test__ = True


class UpdateMonitorTest(BaseUpdateMonitorTest):
    endpoint = "sentry-api-0-organization-monitor-details"
    __test__ = True


class DeleteMonitorTest(BaseDeleteMonitorTest):
    endpoint = "sentry-api-0-organization-monitor-details"
    __test__ = True
