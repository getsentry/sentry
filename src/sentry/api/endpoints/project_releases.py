from __future__ import absolute_import

from django.db import IntegrityError, transaction
from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import Release


class ReleaseSerializer(serializers.Serializer):
    version = serializers.RegexField(r'[a-zA-Z0-9\-_\.]', max_length=200, required=True)


class ProjectReleasesEndpoint(ProjectEndpoint):
    doc_section = DocSection.RELEASES

    def get(self, request, project):
        """
        List a project's releases

        Retrieve a list of releases for a given project.

            {method} {path}

        """
        queryset = Release.objects.filter(
            project=project,
        )

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='-id',
            on_results=lambda x: serialize(x, request.user),
        )

    def post(self, request, project):
        """
        Create a new release

        Create a new release for the given project.

            {method} {path}
            {{
                "version": "abcdef"
            }}

        """
        serializer = ReleaseSerializer(data=request.DATA)

        if serializer.is_valid():
            result = serializer.object

            with transaction.atomic():
                try:
                    release = Release.objects.create(
                        version=result['version'],
                        project=project,
                    )
                except IntegrityError:
                    return Response({
                        'detail': 'Release with version already exists'
                    }, status=400)

            return Response(serialize(release, request.user), status=201)
        return Response(serializer.errors, status=400)
