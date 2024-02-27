from sentry.testutils.silo import region_silo_test
from tests.sentry.monitors.endpoints.test_base import BaseProjectMonitorDetailsTest
from tests.sentry.monitors.endpoints.test_monitor_environment_details import (
    BaseDeleteMonitorTest,
    BaseUpdateMonitorEnvironmentTest,
)


@region_silo_test
class ProjectUpdateMonitorEnvironmentTest(
    BaseUpdateMonitorEnvironmentTest, BaseProjectMonitorDetailsTest
):
    endpoint = "sentry-api-0-project-monitor-environment-details"
    __test__ = True


@region_silo_test()
class ProjectDeleteMonitorTest(BaseDeleteMonitorTest, BaseProjectMonitorDetailsTest):
    endpoint = "sentry-api-0-project-monitor-environment-details"
    __test__ = True
