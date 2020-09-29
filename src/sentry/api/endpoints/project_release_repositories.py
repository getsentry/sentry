from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize

from sentry.models import Release, ReleaseCommit, Repository


class ProjectReleaseRepositories(ProjectEndpoint):

    permission_classes = (ProjectReleasePermission,)

    def get(self, request, project, version):
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

        repository_ids = set(c.commit.repository_id for c in release_commits)

        repositories = Repository.objects.filter(id__in=repository_ids)

        return Response(serialize(list(repositories), request.user,))
