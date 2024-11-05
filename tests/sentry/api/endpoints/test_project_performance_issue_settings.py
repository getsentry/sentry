from unittest.mock import MagicMock, patch

from django.test import override_settings
from rest_framework import status
from rest_framework.exceptions import ErrorDetail

from sentry.api.endpoints.project_performance_issue_settings import SETTINGS_PROJECT_OPTION_KEY
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.helpers.features import with_feature
from sentry.utils.performance_issues.performance_detection import get_merged_settings


class ProjectPerformanceIssueSettingsTest(APITestCase):
    endpoint = "sentry-api-0-project-performance-issue-settings"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user, superuser=True)
        self.project = self.create_project()

    @patch("sentry.models.ProjectOption.objects.get_value")
    @with_feature("organizations:performance-view")
    def test_get_project_options_overrides_detection_defaults(self, get_value):
        response = self.get_success_response(
            self.project.organization.slug, self.project.slug, format="json"
        )

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

        response = self.get_success_response(
            self.project.organization.slug, self.project.slug, format="json"
        )

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
    @with_feature("organizations:performance-view")
    def test_get_project_options_overrides_threshold_defaults(self, get_value):
        with override_options(
            {
                "performance.issues.slow_db_query.duration_threshold": 1000,
                "performance.issues.n_plus_one_db.duration_threshold": 100,
                "performance.issues.n_plus_one_db.count_threshold": 10,
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
            response = self.get_success_response(
                self.project.organization.slug, self.project.slug, format="json"
            )

            # System and project defaults
            assert response.data["slow_db_query_duration_threshold"] == 1000
            assert response.data["n_plus_one_db_duration_threshold"] == 100
            assert response.data["n_plus_one_db_count"] == 10
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
                "n_plus_one_db_count": 50,
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

            response = self.get_success_response(
                self.project.organization.slug, self.project.slug, format="json"
            )

            # Updated project settings
            assert response.data["slow_db_query_duration_threshold"] == 5000
            assert response.data["n_plus_one_db_duration_threshold"] == 10000
            assert response.data["n_plus_one_db_count"] == 50
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
        self.get_error_response(
            self.project.organization.slug,
            self.project.slug,
            format="json",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    @with_feature("organizations:performance-view")
    def test_put_non_super_user_updates_detection_setting(self):
        self.login_as(user=self.user, superuser=False)
        response = self.get_error_response(
            self.project.organization.slug,
            self.project.slug,
            n_plus_one_db_queries_detection_enabled=False,
            method="put",
            status_code=status.HTTP_403_FORBIDDEN,
        )

        assert response.data == {
            "detail": {
                "message": "Passed options are only modifiable internally",
                "code": "superuser-required",
            },
        }

    @with_feature("organizations:performance-view")
    def test_put_super_user_updates_detection_setting(self):
        response = self.get_success_response(
            self.project.organization.slug,
            self.project.slug,
            n_plus_one_db_queries_detection_enabled=False,
            method="put",
            status_code=status.HTTP_200_OK,
        )

        assert not response.data["n_plus_one_db_queries_detection_enabled"]

        get_response = self.get_success_response(
            self.project.organization.slug, self.project.slug, format="json"
        )

        assert not get_response.data["n_plus_one_db_queries_detection_enabled"]

    @override_settings(SENTRY_SELF_HOSTED=False)
    @with_feature("organizations:performance-view")
    @override_options({"superuser.read-write.ga-rollout": True})
    def test_put_superuser_read_write_updates_detection_setting(self):
        # superuser read-only cannot hit put
        self.get_error_response(
            self.project.organization.slug,
            self.project.slug,
            n_plus_one_db_queries_detection_enabled=False,
            method="put",
            status_code=status.HTTP_403_FORBIDDEN,
        )

        # superuser with write can hit put
        self.add_user_permission(self.user, "superuser.write")

        response = self.get_success_response(
            self.project.organization.slug,
            self.project.slug,
            n_plus_one_db_queries_detection_enabled=False,
            method="put",
            status_code=status.HTTP_200_OK,
        )

        assert not response.data["n_plus_one_db_queries_detection_enabled"]

        get_response = self.get_success_response(
            self.project.organization.slug, self.project.slug, format="json"
        )

        assert not get_response.data["n_plus_one_db_queries_detection_enabled"]

    @with_feature("organizations:performance-view")
    def test_put_update_non_super_user_option(self):
        self.login_as(user=self.user, superuser=False)
        response = self.get_success_response(
            self.project.organization.slug,
            self.project.slug,
            n_plus_one_db_duration_threshold=3000,
            method="put",
            status_code=status.HTTP_200_OK,
        )

        assert response.data["n_plus_one_db_duration_threshold"] == 3000

        get_response = self.get_success_response(
            self.project.organization.slug, self.project.slug, format="json"
        )

        assert get_response.data["n_plus_one_db_duration_threshold"] == 3000

    @patch("sentry.models.ProjectOption.objects.get_value")
    @with_feature("organizations:performance-view")
    def test_put_does_not_update_disabled_option(self, get_value):
        self.login_as(user=self.user, superuser=False)
        get_value.return_value = {
            "n_plus_one_db_queries_detection_enabled": False,
        }
        response = self.get_error_response(
            self.project.organization.slug,
            self.project.slug,
            n_plus_one_db_duration_threshold=3000,
            method="put",
            status_code=status.HTTP_403_FORBIDDEN,
        )

        assert response.data == {"detail": "Disabled options can not be modified"}

        get_response = self.get_success_response(
            self.project.organization.slug, self.project.slug, format="json"
        )

        assert (
            get_response.data["n_plus_one_db_duration_threshold"]
            == get_merged_settings(self.project)["n_plus_one_db_duration_threshold"]
        )

    @with_feature("organizations:performance-view")
    def test_update_project_setting_check_validation(self):
        response = self.get_error_response(
            self.project.organization.slug,
            self.project.slug,
            n_plus_one_db_queries_detection_enabled=-1,
            method="put",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

        assert response.data == {
            "n_plus_one_db_queries_detection_enabled": [
                ErrorDetail(string="Must be a valid boolean.", code="invalid")
            ]
        }

    @with_feature("organizations:performance-view")
    def test_update_project_setting_invalid_option(self):
        response = self.get_error_response(
            self.project.organization.slug,
            self.project.slug,
            n_plus_one_db_queries_detection_enabled_invalid=500,
            method="put",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

        assert response.data == {"detail": "Invalid settings option"}

    @patch("sentry.api.base.create_audit_entry")
    @with_feature("organizations:performance-view")
    def test_changing_admin_settings_creates_audit_log(self, create_audit_entry: MagicMock):
        self.get_success_response(
            self.project.organization.slug,
            self.project.slug,
            n_plus_one_db_queries_detection_enabled=False,
            method="put",
            status_code=status.HTTP_200_OK,
        )

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

    @with_feature("organizations:performance-view")
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

        self.get_success_response(
            self.project.organization.slug,
            self.project.slug,
            method="delete",
            status_code=status.HTTP_204_NO_CONTENT,
        )

        assert not self.project.get_option(SETTINGS_PROJECT_OPTION_KEY)[
            "n_plus_one_db_queries_detection_enabled"
        ]  # admin option should persist
        assert self.project.get_option(SETTINGS_PROJECT_OPTION_KEY)[
            "slow_db_queries_detection_enabled"
        ]
        assert "slow_db_query_duration_threshold" not in self.project.get_option(
            SETTINGS_PROJECT_OPTION_KEY
        )  # removes enabled threshold settings

    @with_feature("organizations:performance-view")
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

        self.get_success_response(
            self.project.organization.slug,
            self.project.slug,
            method="delete",
            status_code=status.HTTP_204_NO_CONTENT,
        )

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
