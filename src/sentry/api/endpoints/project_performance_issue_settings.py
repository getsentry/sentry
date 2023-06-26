from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, options, projectoptions
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectSettingPermission
from sentry.api.permissions import SuperuserPermission

MAX_VALUE = 2147483647
TEN_SECONDS = 10000  # ten seconds in milliseconds
SETTINGS_PROJECT_OPTION_KEY = "sentry:performance_issue_settings"


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

        system_defaults = {
            "n_plus_one_db_duration_threshold": options.get(
                "performance.issues.n_plus_one_db.duration_threshold"
            ),
            "slow_db_query_duration_threshold": options.get(
                "performance.issues.slow_db_query.duration_threshold"
            ),
        }

        project_performance_settings_defaults = projectoptions.get_well_known_default(
            SETTINGS_PROJECT_OPTION_KEY,
            project=project,
        )
        project_performance_settings = project.get_option(
            SETTINGS_PROJECT_OPTION_KEY, default=project_performance_settings_defaults
        )

        project_settings = {**project_performance_settings_defaults, **project_performance_settings}

        return Response({**system_defaults, **project_settings})

    def put(self, request: Request, project) -> Response:
        if not self.has_feature(project, request):
            return self.respond(status=status.HTTP_404_NOT_FOUND)

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

        project.delete_option(SETTINGS_PROJECT_OPTION_KEY)
        return Response(status=status.HTTP_204_NO_CONTENT)
