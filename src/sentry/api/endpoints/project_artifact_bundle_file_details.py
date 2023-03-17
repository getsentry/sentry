import base64
import posixpath
from typing import Union

from django.http.response import FileResponse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.endpoints.debug_files import has_download_permission
from sentry.api.endpoints.project_release_file_details import ClosesDependentFiles
from sentry.models import ArtifactBundle, ArtifactBundleArchive, ProjectArtifactBundle


class ProjectArtifactBundleFileDetailsMixin:
    @classmethod
    def download_file_from_artifact_bundle(
        cls, artifact_bundle: ArtifactBundle, file_id: str
    ) -> Union[Response, FileResponse]:
        try:
            file_path = base64.urlsafe_b64decode(file_id).decode()

            archive = ArtifactBundleArchive(artifact_bundle.file.getfile(), build_memory_map=False)

            fp, headers = archive.get_file_by_file_path(file_path)
            file_info = archive.get_file_info(file_path)

            response = FileResponse(
                ClosesDependentFiles(fp, archive),
                content_type=headers.get("content-type", "application/octet-stream"),
            )
            response["Content-Length"] = file_info.file_size if file_info is not None else None
            response["Content-Disposition"] = 'attachment; filename="%s"' % posixpath.basename(
                " ".join(file_path.split())
            )

            return response
        except Exception as exc:
            raise exc

    @classmethod
    def get_file_from_artifact_bundle(
        cls, artifact_bundle: ArtifactBundle, file_id: str
    ) -> Response:
        # TODO(imbriccardo): Implement non-downloadble response.
        pass


@region_silo_endpoint
class ProjectArtifactBundleFileDetailsEndpoint(
    ProjectEndpoint, ProjectArtifactBundleFileDetailsMixin
):
    permission_classes = (ProjectReleasePermission,)

    def get(self, request: Request, project, bundle_id, file_id) -> Response:
        """
        Retrieve the file of an artifact bundle
        `````````````````````````````````

        Return details on an individual file within a release.  This does
        not actually return the contents of the file, just the associated
        metadata.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string project_slug: the slug of the project to retrieve the
                                     file of.
        :pparam string bundle_id: the bundle_id of the artifact bundle that
                                    should contain the file identified by file_id.
        :pparam string file_id: the ID of the file to retrieve.
        :auth: required
        """
        download_requested = request.GET.get("download") is not None

        try:
            artifact_bundle = ArtifactBundle.objects.get(
                organization_id=project.organization.id, bundle_id=bundle_id
            )
        except ArtifactBundle.DoesNotExist:
            return Response(
                {"error": f"The artifact bundle with {bundle_id} does not exist"}, status=404
            )

        try:
            ProjectArtifactBundle.objects.get(
                project_id=project.id, artifact_bundle=artifact_bundle
            )
        except ProjectArtifactBundle.DoesNotExist:
            return Response(
                {"error": f"The artifact bundle with {bundle_id} is not bound to this project"},
                status=400,
            )

        if download_requested and has_download_permission(request, project):
            return self.download_file_from_artifact_bundle(artifact_bundle, file_id)
        elif download_requested:
            return Response(status=403)
        else:
            return self.get_file_from_artifact_bundle(artifact_bundle, file_id)
