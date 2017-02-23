from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import StreamGroupSerializer
from sentry.models import (
    Group, GroupCommitResolution, Project,
    Release, ReleaseCommit,
)


class IssuesResolvedInReleaseEndpoint(OrganizationEndpoint):

    def get(self, request, organization, project_slug, version):

        release = Release.objects.get(version=version)
        project = Project.objects.get(slug=project_slug)

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
