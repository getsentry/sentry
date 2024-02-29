from sentry.testutils.silo import region_silo_test
from tests.sentry.monitors.endpoints.test_base_monitor_details import (
    BaseDeleteMonitorTest,
    BaseMonitorDetailsTest,
    BaseUpdateMonitorTest,
)


@region_silo_test()
class OrganizationMonitorDetailsTest(BaseMonitorDetailsTest):
    endpoint = "sentry-api-0-organization-monitor-details"
    __test__ = True


@region_silo_test()
class UpdateMonitorTest(BaseUpdateMonitorTest):
    endpoint = "sentry-api-0-organization-monitor-details"
    __test__ = True


@region_silo_test()
class DeleteMonitorTest(BaseDeleteMonitorTest):
    endpoint = "sentry-api-0-organization-monitor-details"
    __test__ = True
