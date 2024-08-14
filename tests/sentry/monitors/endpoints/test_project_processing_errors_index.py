from sentry.monitors.processing_errors.errors import ProcessingErrorType
from sentry.monitors.processing_errors.manager import get_errors_for_projects, store_error
from sentry.monitors.testutils import build_checkin_processing_error
from sentry.testutils.cases import APITestCase, MonitorTestCase


class ProjectProcessingErrorsIndexEndpointTest(MonitorTestCase, APITestCase):
    endpoint = "sentry-api-0-project-processing-errors-index"
    method = "delete"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def test_no_error_type(self):
        resp = self.get_error_response(self.organization.slug, self.project.slug)
        assert resp.status_code == 400
        assert resp.content == b'["Invalid error type"]'

    def test_invalid_error_type(self):
        resp = self.get_error_response(
            self.organization.slug, self.project.slug, qs_params={"errortype": "17"}
        )
        assert resp.status_code == 400
        assert resp.content == b'["Invalid error type"]'

    def test(self):
        monitor_errors = [
            build_checkin_processing_error(
                [{"type": ProcessingErrorType.CHECKIN_INVALID_GUID}],
                message_overrides={"project_id": self.project.id},
            ),
            build_checkin_processing_error(
                [{"type": ProcessingErrorType.CHECKIN_INVALID_GUID}],
                message_overrides={"project_id": self.project.id},
            ),
            build_checkin_processing_error(
                [{"type": ProcessingErrorType.CHECKIN_INVALID_GUID}],
                message_overrides={"project_id": self.project.id},
            ),
            build_checkin_processing_error(
                [{"type": ProcessingErrorType.CHECKIN_INVALID_GUID}],
                message_overrides={"project_id": self.project.id},
            ),
            build_checkin_processing_error(
                [{"type": ProcessingErrorType.CHECKIN_INVALID_DURATION, "duration": "-1"}],
                message_overrides={"project_id": self.project.id},
            ),
        ]

        for error in monitor_errors:
            store_error(error, None)

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            qs_params={"errortype": "4"},
        )
        assert resp.status_code == 204
        assert get_errors_for_projects([self.project]) == [monitor_errors[4]]
