from __future__ import absolute_import
import posixpath

from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.organization import OrganizationReleasesBaseEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models import Release, ReleaseFile, Distribution
try:
    from django.http import (
        CompatibleStreamingHttpResponse as StreamingHttpResponse
    )
except ImportError:
    from django.http import StreamingHttpResponse


class ReleaseFileSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200, required=True)


class OrganizationReleaseFileDetailsEndpoint(OrganizationReleasesBaseEndpoint):
    doc_section = DocSection.RELEASES

    def download(self, releasefile):
        file = releasefile.file
        fp = file.getfile()
        response = StreamingHttpResponse(
            iter(lambda: fp.read(4096), b''),
            content_type=file.headers.get('content-type', 'application/octet-stream'),
        )
        response['Content-Length'] = file.size
        response['Content-Disposition'] = 'attachment; filename="%s"' % posixpath.basename(" ".join(releasefile.name.split()))
        return response

    def get(self, request, organization, version, file_id):
        """
        Retrieve an Organization Release's File
        ```````````````````````````````````````

        Return details on an individual file within a release.  This does
        not actually return the contents of the file, just the associated
        metadata.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string version: the version identifier of the release.
        :pparam string file_id: the ID of the file to retrieve.
        :qparam string distribution: the name of the distribution.
        :auth: required
        """
        try:
            release = Release.objects.get(
                organization_id=organization.id,
                version=version,
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        if not self.has_release_permission(request, organization, release):
            raise PermissionDenied

        dist_name = request.GET.get('distribution')
        dist = None
        if dist_name:
            try:
                dist = Distribution.objects.get(
                    release=release,
                    name=dist_name,
                )
            except Distribution.DoesNotExist:
                raise ResourceDoesNotExist

        try:
            releasefile = ReleaseFile.objects.get(
                release=release,
                id=file_id,
                distribution=dist,
            )
        except ReleaseFile.DoesNotExist:
            raise ResourceDoesNotExist

        download_requested = request.GET.get('download') is not None
        if download_requested and (
           request.access.has_scope('project:write')):
            return self.download(releasefile)
        elif download_requested:
            return Response(status=403)
        return Response(serialize(releasefile, request.user))

    def put(self, request, organization, version, file_id):
        """
        Update an Organization Release's File
        `````````````````````````````````````

        Update metadata of an existing file.  Currently only the name of
        the file can be changed.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string version: the version identifier of the release.
        :pparam string file_id: the ID of the file to update.
        :param string name: the new name of the file.
        :param string distribution: the name of the distribution.
        :auth: required
        """
        try:
            release = Release.objects.get(
                organization_id=organization.id,
                version=version,
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        if not self.has_release_permission(request, organization, release):
            raise PermissionDenied

        dist_name = request.DATA.get('distribution')
        dist = None
        if dist_name:
            dist = Distribution.get_or_create(release, dist_name)

        try:
            releasefile = ReleaseFile.objects.get(
                release=release,
                id=file_id,
                distribution=dist,
            )
        except ReleaseFile.DoesNotExist:
            raise ResourceDoesNotExist

        serializer = ReleaseFileSerializer(data=request.DATA)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.object

        releasefile.update(
            name=result['name'],
        )

        return Response(serialize(releasefile, request.user))

    def delete(self, request, organization, version, file_id):
        """
        Delete an Organization Release's File
        `````````````````````````````````````

        Permanently remove a file from a release.

        This will also remove the physical file from storage.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string version: the version identifier of the release.
        :pparam string file_id: the ID of the file to delete.
        :qparam string distribution: the name of the distribution.
        :auth: required
        """
        try:
            release = Release.objects.get(
                organization_id=organization.id,
                version=version,
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        if not self.has_release_permission(request, organization, release):
            raise PermissionDenied

        dist_name = request.GET.get('distribution')
        dist = None
        if dist_name:
            try:
                dist = Distribution.objects.get(
                    release=release,
                    name=dist_name,
                )
            except Distribution.DoesNotExist:
                raise ResourceDoesNotExist

        try:
            releasefile = ReleaseFile.objects.get(
                release=release,
                id=file_id,
                distribution=dist,
            )
        except ReleaseFile.DoesNotExist:
            raise ResourceDoesNotExist

        file = releasefile.file

        # TODO(dcramer): this doesnt handle a failure from file.deletefile() to
        # the actual deletion of the db row
        releasefile.delete()
        file.delete()

        return Response(status=204)
