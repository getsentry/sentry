from tests.sentry.monitors.endpoints.test_base_monitor_checkin_attachment import (
    BaseMonitorCheckInAttachmentEndpointTest,
)


class OrganizationMonitorCheckInAttachmentEndpointTest(BaseMonitorCheckInAttachmentEndpointTest):
    endpoint = "sentry-api-0-organization-monitor-check-in-attachment"
    __test__ = True
