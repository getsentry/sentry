from sentry.testutils.silo import region_silo_test
from tests.sentry.monitors.endpoints.test_base import BaseProjectMonitorTest
from tests.sentry.monitors.endpoints.test_base_monitor_environment_details import (
    BaseDeleteMonitorTest,
    BaseUpdateMonitorEnvironmentTest,
)


@region_silo_test
class ProjectUpdateMonitorEnvironmentTest(BaseUpdateMonitorEnvironmentTest, BaseProjectMonitorTest):
    endpoint = "sentry-api-0-project-monitor-environment-details"
    __test__ = True


@region_silo_test()
class ProjectDeleteMonitorTest(BaseDeleteMonitorTest, BaseProjectMonitorTest):
    endpoint = "sentry-api-0-project-monitor-environment-details"
    __test__ = True
