from __future__ import absolute_import

from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models import Release, ReleaseFile


class ReleaseSerializer(serializers.Serializer):
    ref = serializers.CharField(max_length=64, required=False)
    url = serializers.URLField(required=False)
    dateStarted = serializers.DateTimeField(required=False)
    dateReleased = serializers.DateTimeField(required=False)


class ReleaseDetailsEndpoint(ProjectEndpoint):
    doc_section = DocSection.RELEASES

    def get(self, request, project, version):
        """
        Retrieve a release

        Return details on an individual release.

            {method} {path}

        """
        try:
            release = Release.objects.get(
                project=project,
                version=version,
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        return Response(serialize(release, request.user))

    def put(self, request, project, version):
        """
        Update a release

        Update a release.

            {method} {path}
            {{
                "version": "abcdef",
                "dateReleased": "2015-05-11T02:23:10Z"
            }}

        """
        # TODO(dcramer): handle Activity creation
        try:
            release = Release.objects.get(
                project=project,
                version=version,
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        serializer = ReleaseSerializer(data=request.DATA, partial=True)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.object

        kwargs = {}
        if result.get('dateStarted'):
            kwargs['date_started'] = result['dateStarted']
        if result.get('dateReleased'):
            kwargs['date_released'] = result['dateReleased']
        if result.get('ref'):
            kwargs['ref'] = result['ref']
        if result.get('url'):
            kwargs['url'] = result['url']

        if kwargs:
            release.update(**kwargs)

        return Response(serialize(release, request.user))

    def delete(self, request, project, version):
        """
        Delete a release

        Permanently remove a release and all of its files.

            {method} {path}

        """
        try:
            release = Release.objects.get(
                project=project,
                version=version,
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        # TODO(dcramer): this needs to happen in the queue as it could be a long
        # and expensive operation
        file_list = ReleaseFile.objects.filter(
            release=release,
        ).select_related('file')
        for releasefile in file_list:
            releasefile.file.delete()
            releasefile.delete()
        release.delete()

        return Response(status=204)
