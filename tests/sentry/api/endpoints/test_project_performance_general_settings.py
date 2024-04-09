from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.testutils.cases import APITestCase

PERFORMANCE_SETTINGS_FEATURES = {
    "organizations:performance-view": True,
}


class ProjectPerformanceGeneralSettingsTest(APITestCase):
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

    def test_get_project_general_settings_defaults(self):
        with self.feature(PERFORMANCE_SETTINGS_FEATURES):
            response = self.client.get(self.url, format="json")

        assert response.status_code == 200, response.content

        assert response.data["enable_images"] is False

    def test_get_returns_error_without_feature_enabled(self):
        with self.feature({}):
            response = self.client.get(self.url, format="json")
            assert response.status_code == 404

    def test_updates_to_new_value(self):
        with self.feature(PERFORMANCE_SETTINGS_FEATURES):
            response = self.client.post(
                self.url,
                data={
                    "enable_images": True,
                },
            )
            response = self.client.get(self.url, format="json")
            assert response.data["enable_images"] is True

            response = self.client.post(
                self.url,
                data={
                    "enable_images": False,
                },
            )
            response = self.client.get(self.url, format="json")
            assert response.data["enable_images"] is False

    def test_update_project_setting_check_validation(self):
        with self.feature(PERFORMANCE_SETTINGS_FEATURES):
            response = self.client.post(
                self.url,
                data={
                    "enable_images": -1,
                },
            )

        assert response.status_code == 400, response.content
        assert response.data == {
            "enable_images": [ErrorDetail(string="Must be a valid boolean.", code="invalid")]
        }
