from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import region_silo_test
from tests.sentry.monitors.endpoints.test_base import BaseProjectMonitorTest
from tests.sentry.monitors.endpoints.test_base_monitor_details import (
    BaseDeleteMonitorTest,
    BaseMonitorDetailsTest,
    BaseUpdateMonitorTest,
)


@region_silo_test
class ProjectMonitorDetailsTest(BaseMonitorDetailsTest, BaseProjectMonitorTest):
    endpoint = "sentry-api-0-project-monitor-details"
    __test__ = True


@region_silo_test
@freeze_time()
class ProjectUpdateMonitorTest(BaseUpdateMonitorTest, BaseProjectMonitorTest):
    endpoint = "sentry-api-0-project-monitor-details"
    __test__ = True


@region_silo_test()
class ProjectDeleteMonitorTest(BaseDeleteMonitorTest, BaseProjectMonitorTest):
    endpoint = "sentry-api-0-project-monitor-details"
    __test__ = True
