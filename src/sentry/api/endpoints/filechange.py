from __future__ import absolute_import

from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models import CommitFileChange, Release, ReleaseCommit
from rest_framework.response import Response


class CommitFileChangeEndpoint(ProjectEndpoint):
    doc_section = DocSection.RELEASES
    permission_classes = (ProjectReleasePermission,)

    def get(self, request, project, version):
        """
        List a Release's CommitFileChange objects
        ````````````````````````

        Retrieve a list of commitfilechanges for a given release.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string project_slug: the slug of the project to list the
                                     release files of.
        :pparam string version: the version identifier of the release.
        :auth: required
        """
        try:
            release = Release.objects.get(
                organization_id=project.organization_id,
                projects=project,
                version=version,
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        release_commits = list(ReleaseCommit.objects.filter(
            release=release,
        ).select_related('commit', 'commit__author'))

        commit_list = [rc.commit for rc in release_commits]

        # should this be a loop + lambda expression?

        queryset = list(CommitFileChange.objects.filter(
            commit__in=commit_list
        ))

        context = serialize(queryset, request.user)
        return Response(context)
