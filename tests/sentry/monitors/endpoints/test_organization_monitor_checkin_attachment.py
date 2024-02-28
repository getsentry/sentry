from sentry.testutils.silo import region_silo_test
from tests.sentry.monitors.endpoints.test_base_monitor_checkin_attachment import (
    BaseMonitorCheckInAttachmentEndpointTest,
)


@region_silo_test
class OrganizationMonitorCheckInAttachmentEndpointTest(BaseMonitorCheckInAttachmentEndpointTest):
    endpoint = "sentry-api-0-organization-monitor-check-in-attachment"
    __test__ = True
