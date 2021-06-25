import logging

from sentry.api.bases.organization import OrganizationReleasesBaseEndpoint
from sentry.api.endpoints.project_release_files import ReleaseFilesMixin
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import Release


class OrganizationReleaseFilesEndpoint(OrganizationReleasesBaseEndpoint, ReleaseFilesMixin):
    def get(self, request, organization, version):
        """
        List an Organization Release's Files
        ````````````````````````````````````

        Retrieve a list of files for a given release.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string version: the version identifier of the release.
        :auth: required
        """
        try:
            release = Release.objects.get(organization_id=organization.id, version=version)
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        if not self.has_release_permission(request, organization, release):
            raise ResourceDoesNotExist

        return self.get_releasefiles(request, release, organization.id)

    def post(self, request, organization, version):
        """
        Upload a New Organization Release File
        ``````````````````````````````````````

        Upload a new file for the given release.

        Unlike other API requests, files must be uploaded using the
        traditional multipart/form-data content-type.

        The optional 'name' attribute should reflect the absolute path
        that this file will be referenced as. For example, in the case of
        JavaScript you might specify the full web URI.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string version: the version identifier of the release.
        :param string name: the name (full path) of the file.
        :param file file: the multipart encoded file.
        :param string dist: the name of the dist.
        :param string header: this parameter can be supplied multiple times
                              to attach headers to the file.  Each header
                              is a string in the format ``key:value``.  For
                              instance it can be used to define a content
                              type.
        :auth: required
        """
        try:
            release = Release.objects.get(organization_id=organization.id, version=version)
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        logger = logging.getLogger("sentry.files")
        logger.info("organizationreleasefile.start")

        if not self.has_release_permission(request, organization, release):
            raise ResourceDoesNotExist

        return self.post_releasefile(request, release, logger)
