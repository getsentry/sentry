from unittest.mock import patch

from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test

PERFORMANCE_SETTINGS_FEATURES = {
    "organizations:performance-view": True,
}


@region_silo_test
class ProjectPerformanceIssueSettingsTest(APITestCase):
    endpoint = "sentry-api-0-project-performance-general-settings"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user, superuser=True)
        self.project = self.create_project()

        self.url = reverse(
            self.endpoint,
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
            },
        )

    @patch("sentry.models.ProjectOption.objects.get_value")
    def test_get_project_general_settings_defaults(self, get_value):
        with self.feature(PERFORMANCE_SETTINGS_FEATURES):
            response = self.client.get(self.url, format="json")

        assert response.status_code == 200, response.content

        assert response.data["enable_images"] is False

    def test_get_returns_error_without_feature_enabled(self):
        with self.feature({}):
            response = self.client.get(self.url, format="json")
            assert response.status_code == 404

    def test_update_project_setting_check_validation(self):
        with self.feature(PERFORMANCE_SETTINGS_FEATURES):
            response = self.client.put(
                self.url,
                data={
                    "enable_images": -1,
                },
            )

        assert response.status_code == 400, response.content
        assert response.data == {
            "enable_images": [ErrorDetail(string="Must be a valid boolean.", code="invalid")]
        }
