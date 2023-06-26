from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, projectoptions
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.endpoints.project_performance_issue_settings import SETTINGS_PROJECT_OPTION_KEY
from sentry.api.permissions import SuperuserPermission

SETTINGS_PROJECT_OPTION_ADMIN_KEY = "sentry:performance_issue_settings_admin"


class ProjectPerformanceIssueAdminSettingsSerializer(serializers.Serializer):
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
class ProjectPerformanceIssueAdminSettingsEndpoint(ProjectEndpoint):
    permission_classes = (SuperuserPermission,)  # type: ignore

    def has_feature(self, project, request) -> bool:
        return features.has(
            "organizations:performance-view", project.organization, actor=request.user
        )

    def put(self, request: Request, project) -> Response:
        if not self.has_feature(project, request):
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        serializer = ProjectPerformanceIssueAdminSettingsSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        performance_issue_settings_default = projectoptions.get_well_known_default(
            SETTINGS_PROJECT_OPTION_KEY,
            project=project,
        )

        performance_issue_admin_settings = project.get_option(
            SETTINGS_PROJECT_OPTION_ADMIN_KEY, default=performance_issue_settings_default
        )

        data = serializer.validated_data

        project.update_option(
            SETTINGS_PROJECT_OPTION_ADMIN_KEY,
            {**performance_issue_settings_default, **performance_issue_admin_settings, **data},
        )

        return Response(data)
