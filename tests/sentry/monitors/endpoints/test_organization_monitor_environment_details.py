from sentry.testutils.silo import region_silo_test
from tests.sentry.monitors.endpoints.test_base_monitor_environment_details import (
    BaseDeleteMonitorTest,
    BaseUpdateMonitorEnvironmentTest,
)


@region_silo_test
class UpdateMonitorEnvironmentTest(BaseUpdateMonitorEnvironmentTest):
    endpoint = "sentry-api-0-organization-monitor-environment-details"
    __test__ = True


@region_silo_test()
class DeleteMonitorTest(BaseDeleteMonitorTest):
    endpoint = "sentry-api-0-organization-monitor-environment-details"
    __test__ = True
