from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test

PERFORMANCE_ISSUE_FEATURES = {
    "organizations:performance-view": True,
    "organizations:performance-issues": True,
}


@region_silo_test
class ProjectPerformanceIssueSettingsTest(APITestCase):
    endpoint = "sentry-api-0-project-performance-issue-settings"

    def setUp(self) -> None:
        super().setUp()

        self.login_as(user=self.user)
        self.project = self.create_project()

        self.url = reverse(
            self.endpoint,
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
            },
        )

    def test_get_returns_default(self):
        with self.feature(PERFORMANCE_ISSUE_FEATURES):
            response = self.client.get(self.url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["performance_issue_creation_enabled_n_plus_one_db"]

    def test_get_returns_error_without_feature_enabled(self):
        with self.feature({}):
            response = self.client.get(self.url, format="json")
            assert response.status_code == 404

    def test_update_project_setting(self):
        with self.feature(PERFORMANCE_ISSUE_FEATURES):
            response = self.client.put(
                self.url,
                data={
                    "performance_issue_creation_enabled_n_plus_one_db": False,
                },
            )

        assert response.status_code == 200, response.content
        assert not response.data["performance_issue_creation_enabled_n_plus_one_db"]

        with self.feature(PERFORMANCE_ISSUE_FEATURES):
            get_response = self.client.get(self.url, format="json")

        assert get_response.status_code == 200, response.content
        assert not get_response.data["performance_issue_creation_enabled_n_plus_one_db"]

    def test_update_project_setting_check_validation(self):
        with self.feature(PERFORMANCE_ISSUE_FEATURES):
            response = self.client.put(
                self.url,
                data={
                    "performance_issue_creation_enabled_n_plus_one_db": 31988,
                },
            )

        assert response.status_code == 400, response.content
        assert response.data == {
            "performance_issue_creation_enabled_n_plus_one_db": [
                ErrorDetail(string="Must be a valid boolean.", code="invalid")
            ]
        }
