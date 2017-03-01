from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import StreamGroupSerializer
from sentry.models import (
    Group, GroupCommitResolution, Project,
    Release, ReleaseCommit,
)


class IssuesResolvedInReleaseEndpoint(ProjectEndpoint):
    doc_section = DocSection.RELEASES
    permission_classes = (ProjectPermission,)

    def get(self, request, project, version):
        """
        List issues to be resolved in a particular release
        ````````````````````````

        Retrieve a list of issues to be resolved in a given release.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string project_slug: the slug of the project associated with the release.
        :pparam string version: the version identifier of the release.
        :auth: required
        """

        release = Release.objects.get(version=version, organization=project.organization)
        project = Project.objects.get(slug=project.slug, organization=project.organization)
        commits = ReleaseCommit.objects.filter(
            release=release,
        ).select_related('commit')

        commitresolutions = GroupCommitResolution.objects.filter(
            commit_id__in=[rc.commit.id for rc in commits]
        )
        groups = Group.objects.filter(project=project,
            id__in=[cr.group_id for cr in commitresolutions]
        )

        context = serialize(
            list(groups), request.user, StreamGroupSerializer(
                stats_period=None
            )
        )
        return Response(context)
