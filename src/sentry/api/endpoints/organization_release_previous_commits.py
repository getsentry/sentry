from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationReleasesBaseEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models import Release
from sentry.utils.commiters import get_previous_releases


class OrganizationReleasePreviousCommitsEndpoint(OrganizationReleasesBaseEndpoint):
    def get(self, request, organization, version):
        """
        Retrieve an Organization's Previous Release that has commits
        ````````````````````````````````````````````````````````````

        Return details on an individual release.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string version: the version identifier of the release.
        :qparam array[string] project:    An optional list of project ids to filter
        :auth: required
        """

        try:
            release = Release.objects.get(organization_id=organization.id, version=version)
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        if not self.has_release_permission(request, organization, release):
            raise ResourceDoesNotExist

        # project_ids = set(map(int, request.GET.getlist("project")))
        prev_release_with_commit = None
        prev_releases = []
        for project in release.projects:
            prev_releases = get_previous_releases(project, version)

        for prev_release in prev_releases:
            if prev_release.last_commit_id:
                prev_release_with_commit = prev_release
                break

        return Response(serialize(prev_release_with_commit, request.user,))
