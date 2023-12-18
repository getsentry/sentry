from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import EnvironmentMixin, region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.api.helpers.releases import get_group_ids_resolved_in_release
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import GroupSerializer
from sentry.models.group import Group


@region_silo_endpoint
class ProjectIssuesResolvedInReleaseEndpoint(ProjectEndpoint, EnvironmentMixin):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }
    permission_classes = (ProjectPermission,)

    def get(self, request: Request, project, version) -> Response:
        """
        List issues to be resolved in a particular release
        ``````````````````````````````````````````````````

        Retrieve a list of issues to be resolved in a given release.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string project_slug: the slug of the project associated with the release.
        :pparam string version: the version identifier of the release.
        :auth: required
        """
        group_ids = get_group_ids_resolved_in_release(project.organization, version)
        groups = Group.objects.filter(project=project, id__in=group_ids)

        context = serialize(
            list(groups),
            request.user,
            GroupSerializer(
                environment_func=self._get_environment_func(request, project.organization_id)
            ),
        )

        return Response(context)
