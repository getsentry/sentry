from __future__ import absolute_import

from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import Release, ReleaseFile


class ReleaseFileSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200, required=True)


class ReleaseFileDetailsEndpoint(ProjectEndpoint):
    doc_section = DocSection.RELEASES

    def get(self, request, project, version, file_id):
        """
        Retrieve a file

        Return details on an individual file within a release.

            {method} {path}

        """
        release = Release.objects.get(
            project=project,
            version=version,
        )
        releasefile = ReleaseFile.objects.get(
            release=release,
            id=file_id,
        )

        return Response(serialize(releasefile, request.user))

    def put(self, request, project, version, file_id):
        """
        Update a file

        Update metadata about an existing file.

            {method} {path}
            {{
                "name": "http://example.com/application.js"
            }}

        """
        release = Release.objects.get(
            project=project,
            version=version,
        )
        releasefile = ReleaseFile.objects.get(
            release=release,
            id=file_id,
        )
        serializer = ReleaseFileSerializer(data=request.DATA)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.object

        releasefile.update(
            name=result['name'],
        )

        return Response(serialize(releasefile, request.user))

    def delete(self, request, project, version, file_id):
        """
        Delete a file

        Permanently remove a file from a release.

            {method} {path}

        This will also remove the physical file from storage.
        """
        release = Release.objects.get(
            project=project,
            version=version,
        )
        releasefile = ReleaseFile.objects.get(
            release=release,
            id=file_id,
        )

        file = releasefile.file

        # TODO(dcramer): this doesnt handle a failure from file.deletefile() to
        # the actual deletion of the db row
        releasefile.delete()
        file.delete()

        return Response(status=204)
