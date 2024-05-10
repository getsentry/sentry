from sentry.monitors.processing_errors import (
    CheckinProcessErrorsManager,
    ProcessingError,
    ProcessingErrorType,
)
from sentry.monitors.testutils import build_checkin_processing_error
from sentry.testutils.cases import APITestCase, MonitorTestCase


class ProjectMonitorProcessingErrorsDetailsEndpointTest(MonitorTestCase, APITestCase):
    endpoint = "sentry-api-0-project-monitor-processing-errors-details"
    method = "delete"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def test_empty(self):
        monitor = self.create_monitor()

        self.get_error_response(self.organization.slug, self.project.slug, monitor.slug, "hi")

    def test(self):
        monitor = self.create_monitor()

        manager = CheckinProcessErrorsManager()
        monitor_error = build_checkin_processing_error(
            [ProcessingError(ProcessingErrorType.CHECKIN_INVALID_GUID, {"guid": "bad"})],
            message_overrides={"project_id": self.project.id},
            payload_overrides={"monitor_slug": monitor.slug},
        )

        manager.store(monitor_error, monitor)
        assert len(manager.get_for_monitor(monitor)) == 1
        self.get_success_response(
            self.organization.slug, self.project.slug, monitor.slug, monitor_error.id
        )
        assert len(manager.get_for_monitor(monitor)) == 0
