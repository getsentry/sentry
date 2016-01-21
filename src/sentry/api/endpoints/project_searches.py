from __future__ import absolute_import

from django.db import IntegrityError, transaction
from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import SavedSearch, SavedSearchUserDefault


class SavedSearchSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=128, required=True)
    query = serializers.CharField(required=True)
    isDefault = serializers.BooleanField(required=False)
    isUserDefault = serializers.BooleanField(required=False)


class ProjectSearchesEndpoint(ProjectEndpoint):
    def get(self, request, project):
        """
        List a project's saved searches

        Retrieve a list of saved searches for a given project.

            {method} {path}

        """
        results = list(SavedSearch.objects.filter(
            project=project,
        ).order_by('name'))

        return Response(serialize(results, request.user))

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
                        is_default=result.get('isDefault', False),
                    )
                except IntegrityError:
                    return Response({
                        'detail': 'Search with same name already exists.'
                    }, status=400)

                if search.is_default:
                    SavedSearch.objects.filter(
                        project=project,
                    ).exclude(
                        id=search.id,
                    ).update(
                        is_default=False,
                    )

                if result.get('isUserDefault'):
                    SavedSearchUserDefault.objects.create_or_update(
                        savedsearch=search,
                        user=request.user,
                        project=project,
                    )

            return Response(serialize(search, request.user), status=201)
        return Response(serializer.errors, status=400)
