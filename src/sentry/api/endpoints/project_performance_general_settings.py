from typing import TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectSettingPermission
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.project import Project
from sentry.projectoptions.defaults import DEFAULT_PROJECT_PERFORMANCE_GENERAL_SETTINGS

SETTINGS_PROJECT_OPTION_KEY = "sentry:performance_general_settings"


class ProjectPerformanceGeneralSettingsResponse(TypedDict):
    enable_images: bool


class ProjectPerformanceGeneralSettingsSerializer(serializers.Serializer):
    enable_images = serializers.BooleanField(
        required=False,
        help_text="Whether to display images from real data, such as image resource previews.",
    )


@extend_schema(tags=["Projects"])
@cell_silo_endpoint
class ProjectPerformanceGeneralSettingsEndpoint(ProjectEndpoint):
    """
    This endpoint is kept private (excluded from the public API docs) because these
    settings only control what the Sentry UI displays (e.g. image previews on resource
    spans) and aren't useful outside of it.
    """

    owner = ApiOwner.DATA_BROWSING
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (ProjectSettingPermission,)

    @extend_schema(
        operation_id="Retrieve a Project's Performance General Settings",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, GlobalParams.PROJECT_ID_OR_SLUG],
        responses={
            200: inline_sentry_response_serializer(
                "ProjectPerformanceGeneralSettingsResponse",
                ProjectPerformanceGeneralSettingsResponse,
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, project) -> Response:
        """
        Return the general performance settings for a project.
        """
        if not self.has_feature(project, request):
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        if not project:
            return Response(status=status.HTTP_404_NOT_FOUND)

        project_option_settings = self.get_current_settings(project)
        return Response(project_option_settings)

    @extend_schema(
        operation_id="Update a Project's Performance General Settings",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, GlobalParams.PROJECT_ID_OR_SLUG],
        request=ProjectPerformanceGeneralSettingsSerializer,
        responses={
            204: RESPONSE_NO_CONTENT,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(self, request: Request, project: Project) -> Response:
        """
        Update the general performance settings for a project. Omitted fields are left unchanged.
        """
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
