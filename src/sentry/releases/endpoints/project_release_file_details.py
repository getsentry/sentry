import posixpath
from collections.abc import Callable
from zipfile import ZipFile

from django.http.response import FileResponse
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.endpoints.debug_files import has_download_permission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.models.release_file import (
    ReleaseFileSerializerResponse,
    decode_release_file_id,
)
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams, ReleaseParams
from sentry.apidocs.response_types import ValidationErrorResponse, as_validation_errors
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.debug_files.release_files import maybe_renew_releasefiles
from sentry.models.distribution import Distribution
from sentry.models.release import Release
from sentry.models.releasefile import ReleaseFile, delete_from_artifact_index, read_artifact_index
from sentry.releases.endpoints.project_release_files import pseudo_releasefile

#: Cannot update release artifacts in release archives
INVALID_UPDATE_MESSAGE = "Can only update release files with integer IDs"


class ReleaseFileSerializer(serializers.Serializer):
    name = serializers.CharField(
        max_length=200, required=True, help_text="The new name (full path) of the file."
    )


def _entry_from_index(release: Release, dist: Distribution | None, url: str) -> ReleaseFile:
    index = read_artifact_index(release, dist)
    if index is None:
        raise ResourceDoesNotExist
    try:
        return index.get("files", {})[url]
    except KeyError:
        raise ResourceDoesNotExist


def _get_from_index(release: Release, dist: Distribution | None, url: str) -> ReleaseFile:
    entry = _entry_from_index(release, dist, url)
    return pseudo_releasefile(url, entry, dist)


class ClosesDependentFiles:
    def __init__(self, f, *closables) -> None:
        self._f = f
        self._closables = closables

    def close(self):
        self._f.close()
        for closable in self._closables:
            closable.close()

    def __iter__(self):
        return self._f

    def __getattr__(self, attr):
        return getattr(self._f, attr)

    def __dir__(self):
        ret = list(super().__dir__())
        ret.extend(dir(self._f))
        ret.sort()
        return ret


class ReleaseFileDetailsMixin:
    """Shared functionality of ProjectReleaseFileDetails and OrganizationReleaseFileDetails

    Only has class methods, but keep it as a class to be consistent with ReleaseFilesMixin.
    """

    @staticmethod
    def download(releasefile):
        file = releasefile.file
        fp = file.getfile()
        response = FileResponse(
            fp,
            content_type=file.headers.get("content-type", "application/octet-stream"),
        )
        response["Content-Length"] = file.size
        response["Content-Disposition"] = 'attachment; filename="%s"' % posixpath.basename(
            " ".join(releasefile.name.split())
        )
        return response

    @staticmethod
    def download_from_archive(release, entry):
        archive_ident = entry["archive_ident"]

        archive_file = ReleaseFile.objects.get(release_id=release.id, ident=archive_ident)
        archive_file_fp = archive_file.file.getfile()
        fp = ZipFile(archive_file_fp).open(entry["filename"])
        headers = entry.get("headers", {})

        response = FileResponse(
            ClosesDependentFiles(fp, archive_file_fp),
            content_type=headers.get("content-type", "application/octet-stream"),
        )
        response["Content-Length"] = entry["size"]
        response["Content-Disposition"] = 'attachment; filename="%s"' % posixpath.basename(
            " ".join(entry["filename"].split())
        )

        return response

    @staticmethod
    def _get_releasefile(release: Release, file_id: str, index_op=_get_from_index):
        """Fetch ReleaseFile either from db or from artifact_index"""
        try:
            id = decode_release_file_id(file_id)
        except ValueError:
            raise ResourceDoesNotExist
        if isinstance(id, int):
            try:
                releasefile = ReleaseFile.public_objects.get(release_id=release.id, id=file_id)
                maybe_renew_releasefiles([releasefile])
                return releasefile
            except ReleaseFile.DoesNotExist:
                raise ResourceDoesNotExist
        else:
            dist, url = id
            if dist is not None:
                # NOTE: Could do one less query if `read_artifact_index` accepted
                # `dist_name`
                try:
                    dist = Distribution.objects.get(
                        organization_id=release.organization_id, name=dist, release=release
                    )
                except Distribution.DoesNotExist:
                    raise ResourceDoesNotExist

            return index_op(release, dist, url)

    @classmethod
    def get_releasefile(
        cls,
        request: Request,
        release: Release,
        file_id: str,
        check_permission_fn: Callable[[], bool],
    ) -> Response[ReleaseFileSerializerResponse] | FileResponse | Response[None]:
        download_requested = request.GET.get("download") is not None
        getter = _entry_from_index if download_requested else _get_from_index
        releasefile = cls._get_releasefile(release, file_id, getter)

        if download_requested and check_permission_fn():
            if isinstance(releasefile, ReleaseFile):
                return cls.download(releasefile)
            else:
                return cls.download_from_archive(release, releasefile)
        elif download_requested:
            return Response(status=403)

        body: ReleaseFileSerializerResponse = serialize(releasefile, request.user)
        return Response(body)

    @staticmethod
    def update_releasefile(
        request: Request, release: Release, file_id: str
    ) -> Response[ReleaseFileSerializerResponse] | Response[ValidationErrorResponse]:
        try:
            int(file_id)
        except ValueError:
            raise ParseError(INVALID_UPDATE_MESSAGE)

        try:
            releasefile = ReleaseFile.public_objects.get(release_id=release.id, id=file_id)
        except ReleaseFile.DoesNotExist:
            raise ResourceDoesNotExist

        serializer = ReleaseFileSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(as_validation_errors(serializer), status=400)

        result = serializer.validated_data

        releasefile.update(name=result["name"])

        body: ReleaseFileSerializerResponse = serialize(releasefile, request.user)
        return Response(body)

    @classmethod
    def delete_releasefile(cls, release, file_id):
        result = cls._get_releasefile(release, file_id, delete_from_artifact_index)
        if result is True:
            # was successfully deleted from index
            return Response(status=204)
        if result is False:
            # was not found in index
            return Response(status=404)

        # At this point, assume that result is individual release file, not an archived artifact
        releasefile = result

        try:
            releasefile = ReleaseFile.public_objects.get(release_id=release.id, id=file_id)
        except ReleaseFile.DoesNotExist:
            raise ResourceDoesNotExist

        file = releasefile.file

        # TODO(dcramer): this doesnt handle a failure from file.delete() to
        # the actual deletion of the db row
        releasefile.delete()
        file.delete()

        return Response(status=204)


@extend_schema(tags=["Releases"])
@cell_silo_endpoint
class ProjectReleaseFileDetailsEndpoint(ProjectEndpoint, ReleaseFileDetailsMixin):
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (ProjectReleasePermission,)

    @extend_schema(
        operation_id="Retrieve a Project Release's File",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            ReleaseParams.VERSION,
            ReleaseParams.FILE_ID,
            OpenApiParameter(
                name="download",
                location="query",
                required=False,
                type=str,
                description="If set, download the file contents instead of returning metadata.",
            ),
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ReleaseFileResponse", ReleaseFileSerializerResponse
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: Request, project, version, file_id
    ) -> Response[ReleaseFileSerializerResponse] | FileResponse | Response[None]:
        """
        Return metadata for an individual file within a release. Does not return the file
        contents unless `download` is set.
        """
        try:
            release = Release.objects.get(
                organization_id=project.organization_id, projects=project, version=version
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        return self.get_releasefile(
            request,
            release,
            file_id,
            check_permission_fn=lambda: has_download_permission(request, project),
        )

    @extend_schema(
        operation_id="Update a Project Release's File",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            ReleaseParams.VERSION,
            ReleaseParams.FILE_ID,
        ],
        request=ReleaseFileSerializer,
        responses={
            200: inline_sentry_response_serializer(
                "ReleaseFileResponse", ReleaseFileSerializerResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def put(
        self, request: Request, project, version, file_id
    ) -> Response[ReleaseFileSerializerResponse] | Response[ValidationErrorResponse]:
        """
        Update metadata of an existing release file. Currently only the name of the file
        can be changed.
        """
        try:
            release = Release.objects.get(
                organization_id=project.organization_id, projects=project, version=version
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        return self.update_releasefile(request, release, file_id)

    @extend_schema(
        operation_id="Delete a Project Release's File",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            ReleaseParams.VERSION,
            ReleaseParams.FILE_ID,
        ],
        responses={
            204: RESPONSE_NO_CONTENT,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(self, request: Request, project, version, file_id) -> Response:
        """
        Permanently remove a file from a release. Also removes the physical file from
        storage, unless it is stored as part of an artifact bundle.
        """
        try:
            release = Release.objects.get(
                organization_id=project.organization_id, projects=project, version=version
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        return self.delete_releasefile(release, file_id)
