from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.skips import requires_snuba
from tests.sentry.monitors.endpoints.test_base import BaseProjectMonitorTest
from tests.sentry.monitors.endpoints.test_base_monitor_checkin_index import (
    BaseListMonitorCheckInsTest,
)

pytestmark = requires_snuba


@freeze_time()
class ProjectListMonitorCheckInsTest(BaseListMonitorCheckInsTest, BaseProjectMonitorTest):
    endpoint = "sentry-api-0-project-monitor-check-in-index"
    __test__ = True
