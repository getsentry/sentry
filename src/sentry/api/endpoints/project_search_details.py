from __future__ import absolute_import

from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models import SavedSearch


class SavedSearchSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=128, required=True)
    query = serializers.CharField(required=True)


class ProjectSearchDetailsEndpoint(ProjectEndpoint):
    def get(self, request, project, search_id):
        """
        Retrieve a saved search

        Return details on an individual saved search.

            {method} {path}

        """
        try:
            search = SavedSearch.objects.get(
                project=project,
                id=search_id,
            )
        except SavedSearch.DoesNotExist:
            raise ResourceDoesNotExist

        return Response(serialize(search, request.user))

    def put(self, request, project, search_id):
        """
        Update a saved search

        Update a saved search.

            {method} {path}
            {{
                "version": "abcdef",
                "dateSavedSearchd": "2015-05-11T02:23:10Z"
            }}

        """
        try:
            search = SavedSearch.objects.get(
                project=project,
                id=search_id,
            )
        except SavedSearch.DoesNotExist:
            raise ResourceDoesNotExist

        serializer = SavedSearchSerializer(data=request.DATA, partial=True)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.object

        kwargs = {}
        if result.get('name'):
            kwargs['name'] = result['name']
        if result.get('text'):
            kwargs['text'] = result['text']

        if kwargs:
            search.update(**kwargs)

        return Response(serialize(search, request.user))

    def delete(self, request, project, search_id):
        """
        Delete a saved search

        Permanently remove a saved search.

            {method} {path}

        """
        try:
            search = SavedSearch.objects.get(
                project=project,
                id=search_id,
            )
        except SavedSearch.DoesNotExist:
            raise ResourceDoesNotExist

        search.delete()

        return Response(status=204)
