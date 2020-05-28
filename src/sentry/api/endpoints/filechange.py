from __future__ import absolute_import

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
        `````````````````````````````````````````````

        Retrieve a list of files that were changed in a given release's commits.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string version: the version identifier of the release.
        :qparam int limit: how many files should be returned at maximum
        :auth: required
        """
        try:
            release = Release.objects.get(organization=organization, version=version)
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        if not self.has_release_permission(request, organization, release):
            raise ResourceDoesNotExist

        try:
            limit = int(request.GET.get("limit"))
        except ValueError:
            limit = None

        queryset = list(
            CommitFileChange.objects.filter(
                commit_id__in=ReleaseCommit.objects.filter(release=release).values_list(
                    "commit_id", flat=True
                )
            )[:limit]
        )

        context = serialize(queryset, request.user)
        return Response(context)
