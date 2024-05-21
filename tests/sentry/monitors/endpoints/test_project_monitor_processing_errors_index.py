from sentry.api.serializers import serialize
from sentry.monitors.processing_errors.errors import ProcessingErrorType
from sentry.monitors.processing_errors.manager import store_error
from sentry.monitors.testutils import build_checkin_processing_error
from sentry.testutils.cases import APITestCase, MonitorTestCase
from sentry.utils import json


class ProjectMonitorProcessingErrorsIndexEndpointTest(MonitorTestCase, APITestCase):
    endpoint = "sentry-api-0-project-monitor-processing-errors-index"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def test_empty(self):
        monitor = self.create_monitor()

        resp = self.get_success_response(self.organization.slug, self.project.slug, monitor.slug)
        assert resp.data == []

    def test(self):
        monitor = self.create_monitor()

        monitor_errors = [
            build_checkin_processing_error(
                [{"type": ProcessingErrorType.CHECKIN_INVALID_GUID}],
                message_overrides={"project_id": self.project.id},
                payload_overrides={"monitor_slug": monitor.slug},
            ),
            build_checkin_processing_error(
                [{"type": ProcessingErrorType.MONITOR_DISABLED}],
                message_overrides={"project_id": self.project.id},
                payload_overrides={"monitor_slug": monitor.slug},
            ),
        ]
        project_error = build_checkin_processing_error(
            [{"type": ProcessingErrorType.ORGANIZATION_KILLSWITCH_ENABLED}],
            message_overrides={"project_id": self.project.id},
        )

        store_error(monitor_errors[0], monitor)
        store_error(monitor_errors[1], monitor)
        store_error(project_error, None)

        resp = self.get_success_response(self.organization.slug, self.project.slug, monitor.slug)
        assert resp.data == json.loads(json.dumps(serialize(list(reversed(monitor_errors)))))
