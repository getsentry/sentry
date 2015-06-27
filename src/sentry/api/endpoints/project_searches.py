from __future__ import absolute_import

from django.db import IntegrityError, transaction
from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import SavedSearch


class SavedSearchSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=128, required=True)
    query = serializers.CharField(required=True)


class ProjectSearchesEndpoint(ProjectEndpoint):
    def get(self, request, project):
        """
        List a project's saved searches

        Retrieve a list of saved searches for a given project.

            {method} {path}

        """
        queryset = SavedSearch.objects.filter(
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
        Create a new saved search

        Create a new saved search for the given project.

            {method} {path}
            {{
                "name": "Latest Release",
                "query": "release:[latest]"
            }}

        """
        serializer = SavedSearchSerializer(data=request.DATA)

        if serializer.is_valid():
            result = serializer.object

            with transaction.atomic():
                try:
                    search = SavedSearch.objects.create(
                        project=project,
                        name=result['name'],
                        query=result['query'],
                    )
                except IntegrityError:
                    return Response({
                        'detail': 'Search with same name already exists.'
                    }, status=400)

            return Response(serialize(search, request.user), status=201)
        return Response(serializer.errors, status=400)
