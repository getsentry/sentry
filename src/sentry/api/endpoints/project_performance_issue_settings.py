from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, projectoptions
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectSettingPermission

MAX_VALUE = 2147483647
SETTINGS_PROJECT_OPTION_KEY = "sentry:performance_issue_settings"


class ProjectPerformanceIssueSettingsSerializer(serializers.Serializer):
    n_plus_one_db_detection_rate = serializers.FloatField(required=False, min_value=0, max_value=1)
    n_plus_one_db_issue_rate = serializers.FloatField(required=False, min_value=0, max_value=1)
    n_plus_one_db_count = serializers.IntegerField(required=False, min_value=0, max_value=MAX_VALUE)
    n_plus_one_db_duration_threshold = serializers.IntegerField(
        required=False, min_value=0, max_value=MAX_VALUE
    )


@region_silo_endpoint
class ProjectPerformanceIssueSettingsEndpoint(ProjectEndpoint):
    private = True  # TODO: Remove after EA.
    permission_classes = (ProjectSettingPermission,)

    def has_feature(self, project, request) -> bool:
        return features.has(
            "organizations:performance-view", project.organization, actor=request.user
        ) and features.has(
            "organizations:performance-issues", project.organization, actor=request.user
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

        performance_issue_settings_default = projectoptions.get_well_known_default(
            SETTINGS_PROJECT_OPTION_KEY,
            project=project,
        )
        performance_issue_settings = project.get_option(
            SETTINGS_PROJECT_OPTION_KEY, default=performance_issue_settings_default
        )
        return Response({**performance_issue_settings_default, **performance_issue_settings})

    def put(self, request: Request, project) -> Response:
        if not self.has_feature(project, request):
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        serializer = ProjectPerformanceIssueSettingsSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        performance_issue_settings = projectoptions.get_well_known_default(
            SETTINGS_PROJECT_OPTION_KEY,
            project=project,
        )

        data = serializer.validated_data

        project.update_option(SETTINGS_PROJECT_OPTION_KEY, {**performance_issue_settings, **data})

        return Response(data)

    def delete(self, request: Request, project) -> Response:
        if not self.has_feature(project, request):
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        project.delete_option(SETTINGS_PROJECT_OPTION_KEY)
        return Response(status=status.HTTP_204_NO_CONTENT)
