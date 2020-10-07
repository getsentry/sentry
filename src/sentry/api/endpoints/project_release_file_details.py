from __future__ import absolute_import
import posixpath

from django.http import StreamingHttpResponse
from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models import Release, ReleaseFile


class ReleaseFileSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200, required=True)


class ProjectReleaseFileDetailsEndpoint(ProjectEndpoint):
    permission_classes = (ProjectReleasePermission,)

    def download(self, releasefile):
        file = releasefile.file
        fp = file.getfile()
        response = StreamingHttpResponse(
            iter(lambda: fp.read(4096), b""),
            content_type=file.headers.get("content-type", "application/octet-stream"),
        )
        response["Content-Length"] = file.size
        response["Content-Disposition"] = 'attachment; filename="%s"' % posixpath.basename(
            " ".join(releasefile.name.split())
        )
        return response

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

        try:
            releasefile = ReleaseFile.objects.get(release=release, id=file_id)
        except ReleaseFile.DoesNotExist:
            raise ResourceDoesNotExist

        download_requested = request.GET.get("download") is not None
        if download_requested and (request.access.has_scope("project:write")):
            return self.download(releasefile)
        elif download_requested:
            return Response(status=403)
        return Response(serialize(releasefile, request.user))

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

        try:
            releasefile = ReleaseFile.objects.get(release=release, id=file_id)
        except ReleaseFile.DoesNotExist:
            raise ResourceDoesNotExist

        serializer = ReleaseFileSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.validated_data

        releasefile.update(name=result["name"])

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
