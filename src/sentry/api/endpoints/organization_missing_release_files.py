from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationReleasesBaseEndpoint
from sentry.api.endpoints.project_release_files import ReleaseFilesMixin
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import Release


@region_silo_endpoint
class OrganizationMissingReleaseFilesEndpoint(OrganizationReleasesBaseEndpoint, ReleaseFilesMixin):
    def get(self, request: Request, organization, version) -> Response:
        """
        List a Missing Organization Release's Files based on provided checksums
        ````````````````````````````````````

        Retrieve a list of files for a given release.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string version: the version identifier of the release.
        :qparam string[] checksums: checksums to be used for filtering.
        :auth: required
        """
        try:
            release = Release.objects.get(organization_id=organization.id, version=version)
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        if not self.has_release_permission(request, organization, release):
            raise ResourceDoesNotExist

        return self.find_missing_releasefiles(request, release)
