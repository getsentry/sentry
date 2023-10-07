from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models.release import Release
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.repository import Repository


@region_silo_endpoint
class ProjectReleaseRepositories(ProjectEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    permission_classes = (ProjectReleasePermission,)

    def get(self, request: Request, project, version) -> Response:
        """
        Retrieve Project Repositories from a Release
        ````````````````````````````

        This endpoint is used in the commits and changed files tab of the release details page

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string project_slug: the slug of the project to retrieve the
                                     release of.
        :pparam string version: the version identifier of the release.
        :auth: required
        """

        try:
            release = Release.objects.get(
                organization_id=project.organization_id, projects=project, version=version
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        release_commits = ReleaseCommit.objects.filter(release=release).select_related("commit")

        repository_ids = {c.commit.repository_id for c in release_commits}

        repositories = Repository.objects.filter(id__in=repository_ids)

        return Response(
            serialize(
                list(repositories),
                request.user,
            )
        )
