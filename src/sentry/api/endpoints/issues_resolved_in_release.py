from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import StreamGroupSerializer
from sentry.models import (
    Group,
    GroupCommitResolution,
    GroupResolution,
    Release,
    ReleaseCommit,
)


class IssuesResolvedInReleaseEndpoint(ProjectEndpoint):
    doc_section = DocSection.RELEASES
    permission_classes = (ProjectPermission, )

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
        try:
            release = Release.objects.get(version=version, organization=project.organization)
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        group_ids = set()
        group_ids |= set(
            GroupResolution.objects.filter(
                release=release,
            ).values_list('group_id', flat=True)
        )
        group_ids |= set(
            GroupCommitResolution.objects.filter(
                commit_id__in=ReleaseCommit.objects.filter(
                    release=release,
                ).values_list(
                    'commit_id',
                    flat=True,
                )
            ).values_list(
                'group_id',
                flat=True,
            )
        )

        groups = Group.objects.filter(project=project, id__in=group_ids)

        context = serialize(list(groups), request.user, StreamGroupSerializer(stats_period=None))
        return Response(context)
