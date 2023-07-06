from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, projectoptions
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectSettingPermission
from sentry.api.permissions import SuperuserPermission
from sentry.auth.superuser import is_active_superuser
from sentry.utils.performance_issues.performance_detection import get_merged_settings

MAX_VALUE = 2147483647
TEN_SECONDS = 10000  # ten seconds in milliseconds
TEN_MB = 10000000  # ten MB in bytes
SETTINGS_PROJECT_OPTION_KEY = "sentry:performance_issue_settings"

# These options should only be accessible internally and used by
# support to enable/disable performance issue detection for an outlying project
# on a case-by-case basis.
internal_only_project_setting_options = [
    "uncompressed_assets_detection_enabled",
    "consecutive_http_spans_detection_enabled",
    "large_http_payload_detection_enabled",
    "n_plus_one_db_queries_detection_enabled",
    "n_plus_one_api_calls_detection_enabled",
    "db_on_main_thread_detection_enabled",
    "file_io_on_main_thread_detection_enabled",
    "consecutive_db_queries_detection_enabled",
    "large_render_blocking_asset_detection_enabled",
    "slow_db_queries_detection_enabled",
]


class ProjectOwnerOrSuperUserPermissions(ProjectSettingPermission):
    def has_object_permission(self, request: Request, view, project):
        return super().has_object_permission(
            request, view, project
        ) or SuperuserPermission().has_permission(request, view)


class ProjectPerformanceIssueSettingsSerializer(serializers.Serializer):
    n_plus_one_db_duration_threshold = serializers.IntegerField(
        required=False, min_value=50, max_value=TEN_SECONDS
    )
    slow_db_query_duration_threshold = serializers.IntegerField(
        required=False, min_value=100, max_value=TEN_SECONDS
    )
    render_blocking_fcp_ratio = serializers.FloatField(
        required=False, min_value=0.20, max_value=0.95
    )
    large_http_payload_size_threshold = serializers.IntegerField(
        required=False, min_value=100000, max_value=TEN_MB
    )
    db_on_main_thread_duration_threshold = serializers.IntegerField(
        required=False, min_value=10, max_value=50
    )
    file_io_on_main_thread_duration_threshold = serializers.IntegerField(
        required=False, min_value=10, max_value=50
    )
    uncompressed_asset_duration_threshold = serializers.IntegerField(
        required=False, min_value=100, max_value=TEN_SECONDS
    )
    uncompressed_asset_size_threshold = serializers.IntegerField(
        required=False, min_value=100000, max_value=TEN_MB
    )
    consecutive_db_min_time_saved_threshold = serializers.IntegerField(
        required=False, min_value=50, max_value=5000  # ms
    )
    uncompressed_assets_detection_enabled = serializers.BooleanField(required=False)
    consecutive_http_spans_detection_enabled = serializers.BooleanField(required=False)
    large_http_payload_detection_enabled = serializers.BooleanField(required=False)
    n_plus_one_db_queries_detection_enabled = serializers.BooleanField(required=False)
    n_plus_one_api_calls_detection_enabled = serializers.BooleanField(required=False)
    db_on_main_thread_detection_enabled = serializers.BooleanField(required=False)
    file_io_on_main_thread_detection_enabled = serializers.BooleanField(required=False)
    consecutive_db_queries_detection_enabled = serializers.BooleanField(required=False)
    large_render_blocking_asset_detection_enabled = serializers.BooleanField(required=False)
    slow_db_queries_detection_enabled = serializers.BooleanField(required=False)


@region_silo_endpoint
class ProjectPerformanceIssueSettingsEndpoint(ProjectEndpoint):
    permission_classes = (ProjectOwnerOrSuperUserPermissions,)

    def has_feature(self, project, request) -> bool:
        return features.has(
            "organizations:performance-view", project.organization, actor=request.user
        )

    def get(self, request: Request, project) -> Response:
        """
        Retrieve performance issue settings
        ``````````````````

        Return settings for performance issues

        :pparam string organization_slug: the slug of the organization the
                                          project belongs to.
        :pparam string project_slug: the slug of the project to configure.
        :auth: required
        """

        if not self.has_feature(project, request):
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        return Response(get_merged_settings(project))

    def put(self, request: Request, project) -> Response:
        if not self.has_feature(project, request):
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        body_has_admin_options = any(
            [option in request.data for option in internal_only_project_setting_options]
        )
        if body_has_admin_options and not is_active_superuser(request):
            return Response(
                {"detail": "Passed options are only modifiable internally"},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = ProjectPerformanceIssueSettingsSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        performance_issue_settings_default = projectoptions.get_well_known_default(
            SETTINGS_PROJECT_OPTION_KEY,
            project=project,
        )

        performance_issue_settings = project.get_option(
            SETTINGS_PROJECT_OPTION_KEY, default=performance_issue_settings_default
        )

        data = serializer.validated_data

        project.update_option(
            SETTINGS_PROJECT_OPTION_KEY,
            {**performance_issue_settings_default, **performance_issue_settings, **data},
        )

        return Response(data)

    def delete(self, request: Request, project) -> Response:
        if not self.has_feature(project, request):
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        project_settings = project.get_option(SETTINGS_PROJECT_OPTION_KEY, default={})

        if project_settings:
            settings_only_with_admin_options = {
                option: project_settings[option]
                for option in project_settings
                if option in internal_only_project_setting_options
            }
            project.update_option(SETTINGS_PROJECT_OPTION_KEY, settings_only_with_admin_options)

        return Response(status=status.HTTP_204_NO_CONTENT)
