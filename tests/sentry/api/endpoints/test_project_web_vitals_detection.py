from unittest.mock import patch

from sentry.testutils.cases import APITestCase


class ProjectWebVitalsDetectionTest(APITestCase):
    endpoint = "sentry-api-0-project-web-vitals-detection"
    method = "get"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    @patch("sentry.api.endpoints.project_web_vitals_detection.dispatch_detection_for_project_ids")
    def test_get_success(self, mock_dispatch):
        mock_dispatch.return_value = {self.project.id: {"success": True}}

        response = self.get_success_response(
            self.organization.slug, self.project.slug, status_code=202
        )

        assert response.status_code == 202
        assert response.data == {"status": "dispatched"}
        mock_dispatch.assert_called_once_with([self.project.id])

    def test_get_requires_project_access(self):
        other_user = self.create_user()
        self.login_as(user=other_user)

        response = self.get_error_response(self.organization.slug, self.project.slug)

        assert response.status_code == 403
