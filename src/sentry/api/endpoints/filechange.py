from __future__ import absolute_import

from rest_framework.exceptions import PermissionDenied

from sentry.api.base import DocSection
from sentry.api.bases.organization import OrganizationReleasesBaseEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models import CommitFileChange, Release, ReleaseCommit
from rest_framework.response import Response


class CommitFileChangeEndpoint(OrganizationReleasesBaseEndpoint):
    doc_section = DocSection.RELEASES

    def get(self, request, organization, version):
        """
        Retrieve Files Changed in a Release's Commits
        ````````````````````````

        Retrieve a list of files that were changed in a given release's commits.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string version: the version identifier of the release.
        :auth: required
        """
        try:
            release = Release.objects.get(
                organization=organization,
                version=version,
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        if not self.has_release_permission(request, organization, release):
            raise PermissionDenied

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
