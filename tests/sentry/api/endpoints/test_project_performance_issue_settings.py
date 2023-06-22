from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry import projectoptions
from sentry.api.endpoints.project_performance_issue_settings import SETTINGS_PROJECT_OPTION_KEY
from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test

PERFORMANCE_ISSUE_FEATURES = {
    "organizations:performance-view": True,
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
        assert response.data["slow_db_query_duration_threshold"] == 1000
        assert response.data["n_plus_one_db_duration_threshold"] == 100
        assert response.data["uncompressed_assets_detection_enabled"]
        assert response.data["consecutive_http_spans_detection_enabled"]
        assert response.data["large_http_payload_detection_enabled"]
        assert response.data["n_plus_one_db_queries_detection_enabled"]
        assert response.data["n_plus_one_api_calls_detection_enabled"]
        assert response.data["db_on_main_thread_detection_enabled"]
        assert response.data["file_io_on_main_thread_detection_enabled"]
        assert response.data["consecutive_db_queries_detection_enabled"]
        assert response.data["large_render_blocking_asset_detection_enabled"]
        assert response.data["slow_db_queries_detection_enabled"]

    def test_get_returns_error_without_feature_enabled(self):
        with self.feature({}):
            response = self.client.get(self.url, format="json")
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

        with self.feature(PERFORMANCE_ISSUE_FEATURES):
            get_response = self.client.get(self.url, format="json")

        assert get_response.status_code == 200, response.content
        assert not get_response.data["n_plus_one_db_queries_detection_enabled"]

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

    def test_delete_all_project_settings(self):
        self.project.update_option(
            SETTINGS_PROJECT_OPTION_KEY, {"n_plus_one_db_detection_rate": 0.20}
        )
        assert (
            self.project.get_option(SETTINGS_PROJECT_OPTION_KEY)["n_plus_one_db_detection_rate"]
            == 0.20
        )
        with self.feature(PERFORMANCE_ISSUE_FEATURES):
            response = self.client.delete(
                self.url,
                data={},
            )

        assert response.status_code == 204, response.content
        assert self.project.get_option(
            SETTINGS_PROJECT_OPTION_KEY
        ) == projectoptions.get_well_known_default(SETTINGS_PROJECT_OPTION_KEY)
