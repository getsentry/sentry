from __future__ import absolute_import

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import Activity, Release


class ReleaseSerializer(serializers.Serializer):
    version = serializers.RegexField(r'[a-zA-Z0-9\-_\.]', max_length=64, required=True)
    ref = serializers.CharField(max_length=64, required=False)
    url = serializers.URLField(required=False)
    dateStarted = serializers.DateTimeField(required=False)
    dateReleased = serializers.DateTimeField(required=False)


class ProjectReleasesEndpoint(ProjectEndpoint):
    doc_section = DocSection.RELEASES

    def get(self, request, project):
        """
        List a project's releases

        Retrieve a list of releases for a given project.

            {method} {path}

        To find releases for a given version the 'query' parameter may be to
        create a "version STARTS WITH" filter.

        """
        query = request.GET.get('query')

        queryset = Release.objects.filter(
            project=project,
        )

        if query:
            queryset = queryset.filter(
                version__istartswith=query,
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
                "version": "abcdef",
                "dateReleased": "2015-05-11T02:23:10Z"
            }}

        """
        serializer = ReleaseSerializer(data=request.DATA)

        if serializer.is_valid():
            result = serializer.object

            with transaction.atomic():
                try:
                    release = Release.objects.create(
                        project=project,
                        version=result['version'],
                        ref=result.get('ref'),
                        url=result.get('url'),
                        date_started=result.get('dateStarted'),
                        date_released=result.get('dateReleased') or timezone.now(),
                    )
                except IntegrityError:
                    return Response({
                        'detail': 'Release with version already exists'
                    }, status=400)
                else:
                    Activity.objects.create(
                        type=Activity.RELEASE,
                        project=project,
                        ident=result['version'],
                        data={'version': result['version']},
                        datetime=release.date_released,
                    )

            return Response(serialize(release, request.user), status=201)
        return Response(serializer.errors, status=400)
