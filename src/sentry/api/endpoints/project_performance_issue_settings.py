from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, projectoptions
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectSettingPermission

MAX_VALUE = 2147483647
SETTINGS_PROJECT_OPTION_KEY = "sentry:performance_issue_settings"
ISSUE_PROJECT_OPTION_KEYS = ["performance_issue_creation_enabled_n_plus_one_db"]


class ProjectPerformanceIssueSettingsSerializer(serializers.Serializer):
    performance_issue_creation_enabled_n_plus_one_db = serializers.BooleanField(required=False)


# We can move this into the project options manager if this sticks around.
def get_project_option_with_default(project: str, option_key: str) -> bool:
    prefixed_key = f"sentry:{option_key}"
    setting_default = projectoptions.get_well_known_default(
        prefixed_key,
        project=project,
    )
    return project.get_option(prefixed_key, default=setting_default)


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

        performance_issue_settings = {
            k: get_project_option_with_default(project, k) for k in ISSUE_PROJECT_OPTION_KEYS
        }
        return Response(performance_issue_settings)

    def put(self, request: Request, project) -> Response:
        if not self.has_feature(project, request):
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        serializer = ProjectPerformanceIssueSettingsSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        for k, v in data.items():
            prefixed_key = f"sentry:{k}"
            project.update_option(prefixed_key, v)

        return Response(data)
