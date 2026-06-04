from tests.sentry.monitors.endpoints.test_base import BaseProjectMonitorTest
from tests.sentry.monitors.endpoints.test_base_monitor_environment_details import (
    BaseDeleteMonitorTest,
    BaseUpdateMonitorEnvironmentTest,
)


class ProjectUpdateMonitorEnvironmentTest(BaseUpdateMonitorEnvironmentTest, BaseProjectMonitorTest):
    endpoint = "sentry-api-0-project-monitor-environment-details"
    __test__ = True


class ProjectDeleteMonitorTest(BaseDeleteMonitorTest, BaseProjectMonitorTest):
    endpoint = "sentry-api-0-project-monitor-environment-details"
    __test__ = True
