from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.endpoints.project_release_files import ReleaseFilesMixin
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import Release


@region_silo_endpoint
class ProjectMissingReleaseFilesEndpoint(ProjectEndpoint, ReleaseFilesMixin):
    permission_classes = (ProjectReleasePermission,)

    def get(self, request: Request, project, version) -> Response:
        """
        List a Missing Project Release's Files based on provided checksums
        ````````````````````````````````````

        Retrieve a list of files for a given release.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string project_slug: the slug of the project to list the
                                     release files of.
        :pparam string version: the version identifier of the release.
        :qparam string[] checksums: checksums to be used for filtering.
        :auth: required
        """
        try:
            release = Release.objects.get(
                organization_id=project.organization_id, projects=project, version=version
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        return self.find_missing_releasefiles(request, release)
