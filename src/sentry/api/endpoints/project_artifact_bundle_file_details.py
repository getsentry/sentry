import base64
import binascii
import posixpath
from typing import Union

import sentry_sdk
from django.http.response import FileResponse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.endpoints.debug_files import has_download_permission
from sentry.api.endpoints.project_release_file_details import ClosesDependentFiles
from sentry.models.artifactbundle import ArtifactBundle, ArtifactBundleArchive


class ProjectArtifactBundleFileDetailsMixin:
    @classmethod
    def download_file_from_artifact_bundle(
        cls, file_path: str, archive: ArtifactBundleArchive
    ) -> Union[Response, FileResponse]:
        try:
            fp, headers = archive.get_file(file_path)
            file_info = archive.get_file_info(file_path)
        except Exception:
            # In case we fail here, we want to close the fail before returning.
            archive.close()
            return Response(
                {"error": f"The file {file_path} can't be found in the artifact bundle"},
                status=404,
            )

        response = FileResponse(
            ClosesDependentFiles(fp, archive),
            content_type=headers.get("content-type", "application/octet-stream"),
        )
        response["Content-Length"] = file_info.file_size if file_info is not None else None
        response["Content-Disposition"] = 'attachment; filename="%s"' % posixpath.basename(
            " ".join(file_path.split())
        )

        return response


@region_silo_endpoint
class ProjectArtifactBundleFileDetailsEndpoint(
    ProjectEndpoint, ProjectArtifactBundleFileDetailsMixin
):
    owner = ApiOwner.WEB_FRONTEND_SDKS
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }
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
        if not has_download_permission(request, project):
            return Response(
                {"error": "You don't have the permissions to download this file"}, status=403
            )

        try:
            file_path = base64.urlsafe_b64decode(file_id).decode()
        except (binascii.Error, UnicodeDecodeError):
            return Response(
                {"error": f"The file_id {file_id} is invalid"},
                status=400,
            )

        try:
            artifact_bundle = ArtifactBundle.objects.filter(
                organization_id=project.organization.id,
                bundle_id=bundle_id,
                projectartifactbundle__project_id=project.id,
            )[0]
        except IndexError:
            return Response(
                {
                    "error": f"The artifact bundle with {bundle_id} is not bound to this project or doesn't exist"
                },
                status=400,
            )

        try:
            archive = ArtifactBundleArchive(artifact_bundle.file.getfile(), build_memory_map=False)
        except Exception as exc:
            sentry_sdk.capture_exception(exc)
            return Response(
                {"error": f"The artifact bundle {artifact_bundle.bundle_id} can't be opened"},
                status=400,
            )

        return self.download_file_from_artifact_bundle(file_path, archive)
