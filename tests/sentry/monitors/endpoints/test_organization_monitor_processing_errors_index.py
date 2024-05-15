from sentry.api.serializers import serialize
from sentry.monitors.processing_errors.errors import ProcessingErrorType
from sentry.monitors.processing_errors.manager import store_error
from sentry.monitors.testutils import build_checkin_processing_error
from sentry.testutils.cases import APITestCase, MonitorTestCase
from sentry.utils import json


class OrganizationMonitorProcessingErrorsIndexEndpointTest(MonitorTestCase, APITestCase):
    endpoint = "sentry-api-0-organization-monitor-processing-errors-index"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def test_empty(self):
        resp = self.get_success_response(self.organization.slug)
        assert resp.data == []

    def test(self):
        monitor = self.create_monitor()
        project_2 = self.create_project()

        monitor_error = build_checkin_processing_error(
            message_overrides={"project_id": self.project.id},
            payload_overrides={"monitor_slug": monitor.slug},
        )

        project_errors = [
            build_checkin_processing_error(
                [{"type": ProcessingErrorType.ORGANIZATION_KILLSWITCH_ENABLED}],
                message_overrides={"project_id": self.project.id},
            ),
            build_checkin_processing_error(
                [{"type": ProcessingErrorType.MONITOR_INVALID_ENVIRONMENT, "reason": "bad env"}],
                message_overrides={"project_id": self.project.id},
            ),
            build_checkin_processing_error(
                [{"type": ProcessingErrorType.MONITOR_DISABLED}],
                message_overrides={"project_id": project_2.id},
            ),
        ]

        store_error(monitor_error, monitor)
        for error in project_errors:
            store_error(error, None)

        resp = self.get_success_response(
            self.organization.slug, project=[self.project.id, project_2.id]
        )
        assert resp.data == json.loads(json.dumps(serialize(list(reversed(project_errors)))))

        resp = self.get_success_response(self.organization.slug, project=[self.project.id])
        assert resp.data == json.loads(json.dumps(serialize(list(reversed(project_errors[:2])))))

        resp = self.get_success_response(self.organization.slug, project=[project_2.id])
        assert resp.data == json.loads(json.dumps(serialize(list(reversed(project_errors[2:])))))
