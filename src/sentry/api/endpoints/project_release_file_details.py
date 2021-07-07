import posixpath
from typing import Optional
from zipfile import ZipFile

from django.http.response import FileResponse
from rest_framework import serializers
from rest_framework.exceptions import ParseError
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.endpoints.debug_files import has_download_permission
from sentry.api.endpoints.project_release_files import pseudo_releasefile
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.models.release_file import decode_release_file_id
from sentry.models import Release, ReleaseFile
from sentry.models.distribution import Distribution
from sentry.models.releasefile import delete_from_artifact_index, read_artifact_index

#: Cannot update release artifacts in release archives
INVALID_UPDATE_MESSAGE = "Can only update release files with integer IDs"


class ReleaseFileSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200, required=True)


def _entry_from_index(release: Release, dist: Optional[Distribution], url: str) -> ReleaseFile:
    index = read_artifact_index(release, dist)
    if index is None:
        raise ResourceDoesNotExist
    try:
        return index.get("files", {})[url]
    except KeyError:
        raise ResourceDoesNotExist


def _get_from_index(release: Release, dist: Optional[Distribution], url: str) -> ReleaseFile:
    entry = _entry_from_index(release, dist, url)
    return pseudo_releasefile(url, entry, dist)


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

        # Do not use ReleaseFileCache here, we view download as a singular event
        archive_file = ReleaseFile.objects.get(release_id=release.id, ident=archive_ident)
        archive = ZipFile(archive_file.file.getfile())
        fp = archive.open(entry["filename"])
        headers = entry.get("headers", {})

        response = FileResponse(
            fp,
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
                return ReleaseFile.public_objects.get(release_id=release.id, id=file_id)
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
    def get_releasefile(cls, request, release, file_id, check_permission_fn):
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

        return Response(serialize(releasefile, request.user))

    @staticmethod
    def update_releasefile(request, release, file_id):
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
            return Response(serializer.errors, status=400)

        result = serializer.validated_data

        releasefile.update(name=result["name"])

        return Response(serialize(releasefile, request.user))

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

        # TODO(dcramer): this doesnt handle a failure from file.deletefile() to
        # the actual deletion of the db row
        releasefile.delete()
        file.delete()

        return Response(status=204)


class ProjectReleaseFileDetailsEndpoint(ProjectEndpoint, ReleaseFileDetailsMixin):
    permission_classes = (ProjectReleasePermission,)

    def get(self, request, project, version, file_id):
        """
        Retrieve a Project Release's File
        `````````````````````````````````

        Return details on an individual file within a release.  This does
        not actually return the contents of the file, just the associated
        metadata.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string project_slug: the slug of the project to retrieve the
                                     file of.
        :pparam string version: the version identifier of the release.
        :pparam string file_id: the ID of the file to retrieve.
        :auth: required
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

    def put(self, request, project, version, file_id):
        """
        Update a File
        `````````````

        Update metadata of an existing file.  Currently only the name of
        the file can be changed.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string project_slug: the slug of the project to update the
                                     file of.
        :pparam string version: the version identifier of the release.
        :pparam string file_id: the ID of the file to update.
        :param string name: the new name of the file.
        :auth: required
        """

        try:
            release = Release.objects.get(
                organization_id=project.organization_id, projects=project, version=version
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        return self.update_releasefile(request, release, file_id)

    def delete(self, request, project, version, file_id):
        """
        Delete a File
        `````````````

        Permanently remove a file from a release.

        This will also remove the physical file from storage, except if it is
        stored as part of an artifact bundle.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string project_slug: the slug of the project to delete the
                                     file of.
        :pparam string version: the version identifier of the release.
        :pparam string file_id: the ID of the file to delete.
        :auth: required
        """
        try:
            release = Release.objects.get(
                organization_id=project.organization_id, projects=project, version=version
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        return self.delete_releasefile(release, file_id)
