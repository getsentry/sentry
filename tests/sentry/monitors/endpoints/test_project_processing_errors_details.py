from sentry.monitors.processing_errors.errors import ProcessingErrorType
from sentry.monitors.processing_errors.manager import get_errors_for_projects, store_error
from sentry.monitors.testutils import build_checkin_processing_error
from sentry.testutils.cases import APITestCase, MonitorTestCase


class ProjectProcessingErrorsDetailsEndpointTest(MonitorTestCase, APITestCase):
    endpoint = "sentry-api-0-project-processing-errors-details"
    method = "delete"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def test_empty(self):
        self.get_error_response(self.organization.slug, self.project.slug, "hi")

    def test(self):
        monitor_error = build_checkin_processing_error(
            [{"type": ProcessingErrorType.CHECKIN_INVALID_GUID}],
            message_overrides={"project_id": self.project.id},
        )

        store_error(monitor_error, None)
        assert len(get_errors_for_projects([self.project])) == 1
        self.get_success_response(self.organization.slug, self.project.slug, monitor_error.id)
        assert len(get_errors_for_projects([self.project])) == 0

    def test_invalid_project(self):
        monitor_error = build_checkin_processing_error(
            [{"type": ProcessingErrorType.CHECKIN_INVALID_GUID}],
            message_overrides={"project_id": self.project.id},
        )
        unrelated_project = self.create_project()
        store_error(monitor_error, None)
        assert len(get_errors_for_projects([self.project])) == 1
        self.get_error_response(
            self.organization.slug, unrelated_project.slug, monitor_error.id, status_code=400
        )
        assert len(get_errors_for_projects([self.project])) == 1
