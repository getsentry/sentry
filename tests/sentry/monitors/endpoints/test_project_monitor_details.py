from sentry.testutils.helpers.datetime import freeze_time
from tests.sentry.monitors.endpoints.test_base import BaseProjectMonitorTest
from tests.sentry.monitors.endpoints.test_base_monitor_details import (
    BaseDeleteMonitorTest,
    BaseMonitorDetailsTest,
    BaseUpdateMonitorTest,
)


class ProjectMonitorDetailsTest(BaseMonitorDetailsTest, BaseProjectMonitorTest):
    endpoint = "sentry-api-0-project-monitor-details"
    __test__ = True


@freeze_time()
class ProjectUpdateMonitorTest(BaseUpdateMonitorTest, BaseProjectMonitorTest):
    endpoint = "sentry-api-0-project-monitor-details"
    __test__ = True


class ProjectDeleteMonitorTest(BaseDeleteMonitorTest, BaseProjectMonitorTest):
    endpoint = "sentry-api-0-project-monitor-details"
    __test__ = True
