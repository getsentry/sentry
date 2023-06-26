from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test

PERFORMANCE_ISSUE_FEATURES = {
    "organizations:performance-view": True,
}


@region_silo_test
class ProjectPerformanceIssueAdminSettingsTest(APITestCase):
    endpoint = "sentry-api-0-project-performance-issue-admin-settings"

    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user(is_superuser=True)
        self.login_as(user=self.user, superuser=True)
        self.project = self.create_project()

        self.url = reverse(
            self.endpoint,
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
            },
        )

    def test_put_returns_forbidden_when_called_by_non_superuser(self):
        with self.feature(PERFORMANCE_ISSUE_FEATURES):
            self.user = self.user = self.create_user()
            self.login_as(user=self.user, superuser=False)
            response = self.client.put(
                self.url,
                data={
                    "n_plus_one_db_queries_detection_enabled": False,
                },
            )
            assert response.status_code == 403

    def test_put_returns_error_without_feature_enabled(self):
        with self.feature({}):
            response = self.client.put(
                self.url,
                data={
                    "n_plus_one_db_queries_detection_enabled": False,
                },
            )
            assert response.status_code == 404

    def test_update_project_setting(self):
        with self.feature(PERFORMANCE_ISSUE_FEATURES):
            response = self.client.put(
                self.url,
                data={
                    "n_plus_one_db_queries_detection_enabled": False,
                },
            )

        assert response.status_code == 200, response.content
        assert not response.data["n_plus_one_db_queries_detection_enabled"]

    def test_update_project_setting_check_validation(self):
        with self.feature(PERFORMANCE_ISSUE_FEATURES):
            response = self.client.put(
                self.url,
                data={
                    "n_plus_one_db_queries_detection_enabled": -1,
                },
            )

        assert response.status_code == 400, response.content
        assert response.data == {
            "n_plus_one_db_queries_detection_enabled": [
                ErrorDetail(string="Must be a valid boolean.", code="invalid")
            ]
        }
