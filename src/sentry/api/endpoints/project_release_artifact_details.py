import posixpath

from django.http import StreamingHttpResponse
from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.endpoints.debug_files import has_download_permission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models import Release, ReleaseFile


class ReleaseFileSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200, required=True)


class ProjectReleaseArtifactDetailsEndpoint(ProjectEndpoint):
    permission_classes = (ProjectReleasePermission,)

    def _streaming_response(self, name, headers, fp, file_size, cleanup=None):
        def iterable():
            yield from iter(lambda: fp.read(4096), b"")
            if cleanup is not None:
                cleanup()

        response = StreamingHttpResponse(
            iterable(),
            content_type=headers.get("content-type", "application/octet-stream"),
        )
        response["Content-Length"] = file_size
        response["Content-Disposition"] = 'attachment; filename="%s"' % posixpath.basename(
            " ".join(name.split())
        )
        return response

    def download(self, releasefile):
        file = releasefile.file
        return self._streaming_response(
            name=releasefile.name,
            headers=file.headers,
            fp=file.getfile(),
            file_size=file.size,
        )

    def download_from_archive(self, archive, file_id):
        manifest_entry = archive.manifest["files"][file_id]
        name = manifest_entry["url"]
        headers = manifest_entry.get("headers", {})
        fp = archive.open(file_id)
        file_size = archive.get_file_size(file_id)
        return self._streaming_response(name, headers, fp, file_size, cleanup=archive.close)

    def _get_from_archive(self, request, project, release, file_id):
        archive = release.get_release_archive()
        if archive is None:
            raise ResourceDoesNotExist
        if file_id not in archive.manifest.get("files", {}):
            raise ResourceDoesNotExist

        download_requested = request.GET.get("download") is not None
        if download_requested and (has_download_permission(request, project)):
            return self.download_from_archive(archive, file_id)
        elif download_requested:
            return Response(status=403)
        else:
            # Can only download at the moment
            raise NotImplementedError

    def get(self, request, project, version, file_id):
        """
        Retrieve a Project Release's Artifact
        `````````````````````````````````````

        The artifact can either be a release file in its own right, or an
        artifact in a release archive.

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

        try:
            file_id = int(file_id)
        except ValueError:
            # Not a numeric ID, check release archive
            filename = file_id.replace("|", "/")
            return self._get_from_archive(request, project, release, filename)

        # TODO: import instead of copy-paste
        try:
            releasefile = ReleaseFile.objects.get(release=release, id=file_id)
        except ReleaseFile.DoesNotExist:
            raise ResourceDoesNotExist

        download_requested = request.GET.get("download") is not None
        if download_requested and (has_download_permission(request, project)):
            return self.download(releasefile)
        elif download_requested:
            return Response(status=403)
        return Response(serialize(releasefile, request.user))

    def delete(self, request, project, version, file_id):
        """
        Delete a File
        `````````````

        Permanently remove a file from a release.

        This will also remove the physical file from storage.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string project_slug: the slug of the project to delete the
                                     file of.
        :pparam string version: the version identifier of the release.
        :pparam string file_id: the ID of the file to delete.
        :auth: required
        """

        raise NotImplementedError

        try:
            release = Release.objects.get(
                organization_id=project.organization_id, projects=project, version=version
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        try:
            releasefile = ReleaseFile.objects.get(release=release, id=file_id)
        except ReleaseFile.DoesNotExist:
            raise ResourceDoesNotExist

        file = releasefile.file

        # TODO(dcramer): this doesnt handle a failure from file.deletefile() to
        # the actual deletion of the db row
        releasefile.delete()
        file.delete()

        return Response(status=204)
