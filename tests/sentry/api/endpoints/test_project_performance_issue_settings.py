from unittest.mock import MagicMock, patch

from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.api.endpoints.project_performance_issue_settings import SETTINGS_PROJECT_OPTION_KEY
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.silo import region_silo_test
from sentry.utils.performance_issues.performance_detection import get_merged_settings

PERFORMANCE_ISSUE_FEATURES = {
    "organizations:performance-view": True,
}


@region_silo_test
class ProjectPerformanceIssueSettingsTest(APITestCase):
    endpoint = "sentry-api-0-project-performance-issue-settings"

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
    def test_get_project_options_overrides_detection_defaults(self, get_value):
        with self.feature(PERFORMANCE_ISSUE_FEATURES):
            response = self.client.get(self.url, format="json")

        assert response.status_code == 200, response.content

        assert response.data["n_plus_one_db_queries_detection_enabled"]
        assert response.data["slow_db_queries_detection_enabled"]
        assert response.data["uncompressed_assets_detection_enabled"]
        assert response.data["consecutive_http_spans_detection_enabled"]
        assert response.data["large_http_payload_detection_enabled"]
        assert response.data["n_plus_one_api_calls_detection_enabled"]
        assert response.data["db_on_main_thread_detection_enabled"]
        assert response.data["file_io_on_main_thread_detection_enabled"]
        assert response.data["consecutive_db_queries_detection_enabled"]
        assert response.data["large_render_blocking_asset_detection_enabled"]

        get_value.return_value = {
            "slow_db_queries_detection_enabled": False,
            "n_plus_one_db_queries_detection_enabled": False,
            "uncompressed_assets_detection_enabled": False,
            "consecutive_http_spans_detection_enabled": False,
            "large_http_payload_detection_enabled": False,
            "n_plus_one_api_calls_detection_enabled": False,
            "db_on_main_thread_detection_enabled": False,
            "file_io_on_main_thread_detection_enabled": False,
            "consecutive_db_queries_detection_enabled": False,
            "large_render_blocking_asset_detection_enabled": False,
        }

        with self.feature(PERFORMANCE_ISSUE_FEATURES):
            response = self.client.get(self.url, format="json")

        assert response.status_code == 200, response.content

        assert not response.data["n_plus_one_db_queries_detection_enabled"]
        assert not response.data["slow_db_queries_detection_enabled"]
        assert not response.data["uncompressed_assets_detection_enabled"]
        assert not response.data["consecutive_http_spans_detection_enabled"]
        assert not response.data["large_http_payload_detection_enabled"]
        assert not response.data["n_plus_one_api_calls_detection_enabled"]
        assert not response.data["db_on_main_thread_detection_enabled"]
        assert not response.data["file_io_on_main_thread_detection_enabled"]
        assert not response.data["consecutive_db_queries_detection_enabled"]
        assert not response.data["large_render_blocking_asset_detection_enabled"]

    @patch("sentry.models.ProjectOption.objects.get_value")
    def test_get_project_options_overrides_threshold_defaults(self, get_value):
        with override_options(
            {
                "performance.issues.slow_db_query.duration_threshold": 1000,
                "performance.issues.n_plus_one_db.duration_threshold": 100,
                "performance.issues.render_blocking_assets.fcp_ratio_threshold": 0.80,
                "performance.issues.large_http_payload.size_threshold": 2000,
                "performance.issues.db_on_main_thread.total_spans_duration_threshold": 33,
                "performance.issues.file_io_on_main_thread.total_spans_duration_threshold": 10,
                "performance.issues.uncompressed_asset.duration_threshold": 300,
                "performance.issues.uncompressed_asset.size_threshold": 200000,
                "performance.issues.consecutive_db.min_time_saved_threshold": 300,
                "performance.issues.n_plus_one_api_calls.total_duration": 300,
                "performance.issues.consecutive_http.min_time_saved_threshold": 2000,
            }
        ):
            with self.feature(PERFORMANCE_ISSUE_FEATURES):
                response = self.client.get(self.url, format="json")

            assert response.status_code == 200, response.content

            # System and project defaults
            assert response.data["slow_db_query_duration_threshold"] == 1000
            assert response.data["n_plus_one_db_duration_threshold"] == 100
            assert response.data["render_blocking_fcp_ratio"] == 0.8
            assert response.data["large_http_payload_size_threshold"] == 2000
            assert response.data["db_on_main_thread_duration_threshold"] == 33
            assert response.data["file_io_on_main_thread_duration_threshold"] == 10
            assert response.data["uncompressed_asset_duration_threshold"] == 300
            assert response.data["uncompressed_asset_size_threshold"] == 200000
            assert response.data["consecutive_db_min_time_saved_threshold"] == 300
            assert response.data["n_plus_one_api_calls_total_duration_threshold"] == 300
            assert response.data["consecutive_http_spans_min_time_saved_threshold"] == 2000

            get_value.return_value = {
                "n_plus_one_db_duration_threshold": 10000,
                "slow_db_query_duration_threshold": 5000,
                "render_blocking_fcp_ratio": 0.8,
                "uncompressed_asset_duration_threshold": 500,
                "uncompressed_asset_size_threshold": 300000,
                "large_http_payload_size_threshold": 10000000,
                "db_on_main_thread_duration_threshold": 50,
                "file_io_on_main_thread_duration_threshold": 33,
                "consecutive_db_min_time_saved_threshold": 5000,
                "n_plus_one_api_calls_total_duration_threshold": 500,
                "consecutive_http_spans_min_time_saved_threshold": 1000,
            }

            with self.feature(PERFORMANCE_ISSUE_FEATURES):
                response = self.client.get(self.url, format="json")

            assert response.status_code == 200, response.content

            # Updated project settings
            assert response.data["slow_db_query_duration_threshold"] == 5000
            assert response.data["n_plus_one_db_duration_threshold"] == 10000
            assert response.data["render_blocking_fcp_ratio"] == 0.8
            assert response.data["uncompressed_asset_duration_threshold"] == 500
            assert response.data["uncompressed_asset_size_threshold"] == 300000
            assert response.data["large_http_payload_size_threshold"] == 10000000
            assert response.data["db_on_main_thread_duration_threshold"] == 50
            assert response.data["file_io_on_main_thread_duration_threshold"] == 33
            assert response.data["consecutive_db_min_time_saved_threshold"] == 5000
            assert response.data["n_plus_one_api_calls_total_duration_threshold"] == 500
            assert response.data["consecutive_http_spans_min_time_saved_threshold"] == 1000

    def test_get_returns_error_without_feature_enabled(self):
        with self.feature({}):
            response = self.client.get(self.url, format="json")
            assert response.status_code == 404

    def test_put_non_super_user_updates_detection_setting(self):
        self.login_as(user=self.user, superuser=False)
        with self.feature(PERFORMANCE_ISSUE_FEATURES):
            response = self.client.put(
                self.url,
                data={
                    "n_plus_one_db_queries_detection_enabled": False,
                },
            )

        assert response.status_code == 403, response.content
        assert response.data == {
            "detail": {
                "message": "Passed options are only modifiable internally",
                "code": "superuser-required",
            },
        }

    def test_put_super_user_updates_detection_setting(self):
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

    def test_put_update_non_super_user_option(self):
        self.login_as(user=self.user, superuser=False)
        with self.feature(PERFORMANCE_ISSUE_FEATURES):
            response = self.client.put(
                self.url,
                data={
                    "n_plus_one_db_duration_threshold": 3000,
                },
            )

        assert response.status_code == 200, response.content
        assert response.data["n_plus_one_db_duration_threshold"] == 3000

        with self.feature(PERFORMANCE_ISSUE_FEATURES):
            get_response = self.client.get(self.url, format="json")

        assert get_response.status_code == 200, response.content
        assert get_response.data["n_plus_one_db_duration_threshold"] == 3000

    @patch("sentry.models.ProjectOption.objects.get_value")
    def test_put_does_not_update_disabled_option(self, get_value):
        self.login_as(user=self.user, superuser=False)
        get_value.return_value = {
            "n_plus_one_db_queries_detection_enabled": False,
        }
        with self.feature(PERFORMANCE_ISSUE_FEATURES):
            response = self.client.put(
                self.url,
                data={
                    "n_plus_one_db_duration_threshold": 3000,
                },
            )

        assert response.status_code == 403, response.content
        assert response.data == {"detail": "Disabled options can not be modified"}

        with self.feature(PERFORMANCE_ISSUE_FEATURES):
            get_response = self.client.get(self.url, format="json")

        assert get_response.status_code == 200, response.content
        assert (
            get_response.data["n_plus_one_db_duration_threshold"]
            == get_merged_settings(self.project)["n_plus_one_db_duration_threshold"]
        )

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

    def test_update_project_setting_invalid_option(self):
        with self.feature(PERFORMANCE_ISSUE_FEATURES):
            response = self.client.put(
                self.url,
                data={
                    "n_plus_one_db_queries_detection_enabled_invalid": 500,
                },
            )

        assert response.status_code == 400, response.content
        assert response.data == {"detail": "Invalid settings option"}

    @patch("sentry.api.base.create_audit_entry")
    def test_changing_admin_settings_creates_audit_log(self, create_audit_entry: MagicMock):

        with self.feature(PERFORMANCE_ISSUE_FEATURES):
            response = self.client.put(
                self.url,
                data={
                    "n_plus_one_db_queries_detection_enabled": False,
                },
            )

        assert response.status_code == 200, response.content

        assert create_audit_entry.called
        ((_, kwargs),) = create_audit_entry.call_args_list
        assert kwargs["data"] == {
            "n_plus_one_db_queries_detection_enabled": False,
            "id": self.project.id,
            "slug": self.project.slug,
            "name": self.project.name,
            "status": self.project.status,
            "public": self.project.public,
        }

    def test_delete_resets_enabled_project_settings(self):
        self.project.update_option(
            SETTINGS_PROJECT_OPTION_KEY,
            {
                "n_plus_one_db_queries_detection_enabled": False,
                "slow_db_queries_detection_enabled": True,
                "slow_db_query_duration_threshold": 5000,
            },
        )

        assert not self.project.get_option(SETTINGS_PROJECT_OPTION_KEY)[
            "n_plus_one_db_queries_detection_enabled"
        ]
        assert self.project.get_option(SETTINGS_PROJECT_OPTION_KEY)[
            "slow_db_queries_detection_enabled"
        ]
        assert (
            self.project.get_option(SETTINGS_PROJECT_OPTION_KEY)["slow_db_query_duration_threshold"]
            == 5000
        )

        with self.feature(PERFORMANCE_ISSUE_FEATURES):
            response = self.client.delete(
                self.url,
                data={},
            )

        assert response.status_code == 204, response.content
        assert not self.project.get_option(SETTINGS_PROJECT_OPTION_KEY)[
            "n_plus_one_db_queries_detection_enabled"
        ]  # admin option should persist
        assert self.project.get_option(SETTINGS_PROJECT_OPTION_KEY)[
            "slow_db_queries_detection_enabled"
        ]
        assert "slow_db_query_duration_threshold" not in self.project.get_option(
            SETTINGS_PROJECT_OPTION_KEY
        )  # removes enabled threshold settings

    def test_delete_does_not_resets_enabled_project_settings(self):
        self.project.update_option(
            SETTINGS_PROJECT_OPTION_KEY,
            {
                "n_plus_one_db_queries_detection_enabled": False,
                "slow_db_queries_detection_enabled": False,
                "slow_db_query_duration_threshold": 5000,
            },
        )

        assert not self.project.get_option(SETTINGS_PROJECT_OPTION_KEY)[
            "n_plus_one_db_queries_detection_enabled"
        ]
        assert not self.project.get_option(SETTINGS_PROJECT_OPTION_KEY)[
            "slow_db_queries_detection_enabled"
        ]
        assert (
            self.project.get_option(SETTINGS_PROJECT_OPTION_KEY)["slow_db_query_duration_threshold"]
            == 5000
        )

        with self.feature(PERFORMANCE_ISSUE_FEATURES):
            response = self.client.delete(
                self.url,
                data={},
            )

        assert response.status_code == 204, response.content
        assert not self.project.get_option(SETTINGS_PROJECT_OPTION_KEY)[
            "n_plus_one_db_queries_detection_enabled"
        ]  # admin option should persist
        assert not self.project.get_option(SETTINGS_PROJECT_OPTION_KEY)[
            "slow_db_queries_detection_enabled"
        ]
        assert (
            self.project.get_option(SETTINGS_PROJECT_OPTION_KEY)["slow_db_query_duration_threshold"]
            == 5000
        )  # setting persists as detection is disabled for corresponding issue
