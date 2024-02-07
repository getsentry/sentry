from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectSettingPermission
from sentry.models.project import Project
from sentry.projectoptions.defaults import DEFAULT_PROJECT_PERFORMANCE_GENERAL_SETTINGS

SETTINGS_PROJECT_OPTION_KEY = "sentry:performance_general_settings"


class ProjectPerformanceGeneralSettingsSerializer(serializers.Serializer):
    enable_images = serializers.BooleanField(required=False)


@region_silo_endpoint
class ProjectPerformanceGeneralSettingsEndpoint(ProjectEndpoint):
    owner = ApiOwner.PERFORMANCE
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (ProjectSettingPermission,)

    def get(self, request: Request, project) -> Response:
        if not self.has_feature(project, request):
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        if not project:
            return Response(status=status.HTTP_404_NOT_FOUND)

        project_option_settings = self.get_current_settings(project)
        return Response(project_option_settings)

    def post(self, request: Request, project: Project) -> Response:
        if not self.has_feature(project, request):
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        if not project:
            return Response(status=status.HTTP_404_NOT_FOUND)

        serializer = ProjectPerformanceGeneralSettingsSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        self.update_settings(project, request.data)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def has_feature(self, project, request) -> bool:
        return features.has(
            "organizations:performance-view", project.organization, actor=request.user
        )

    def get_current_settings(self, project: Project):
        return project.get_option(
            SETTINGS_PROJECT_OPTION_KEY, DEFAULT_PROJECT_PERFORMANCE_GENERAL_SETTINGS
        )

    def update_settings(self, project: Project, new_settings: dict):
        current_settings = self.get_current_settings(project)
        project.update_option(SETTINGS_PROJECT_OPTION_KEY, {**current_settings, **new_settings})
