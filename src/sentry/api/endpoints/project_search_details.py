from __future__ import absolute_import

from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models import SavedSearch, SavedSearchUserDefault


class LimitedSavedSearchSerializer(serializers.Serializer):
    isUserDefault = serializers.BooleanField(required=False)


class SavedSearchSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=128, required=True)
    query = serializers.CharField(required=True)
    isDefault = serializers.BooleanField(required=False)
    isUserDefault = serializers.BooleanField(required=False)


class RelaxedSearchPermission(ProjectPermission):
    scope_map = {
        'GET': ['project:read', 'project:write', 'project:delete'],
        'POST': ['project:write', 'project:delete'],
        # members can do partial writes
        'PUT': ['project:write', 'project:delete', 'project:read'],
        'DELETE': ['project:delete'],
    }


class ProjectSearchDetailsEndpoint(ProjectEndpoint):
    permission_classes = (RelaxedSearchPermission,)

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
                "name: "Unresolved",
                "query": "is:unresolved",
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

        if request.access.has_team_scope(project.team, 'project:write'):
            serializer = SavedSearchSerializer(data=request.DATA, partial=True)
        else:
            serializer = LimitedSavedSearchSerializer(data=request.DATA, partial=True)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.object

        kwargs = {}
        if result.get('name'):
            kwargs['name'] = result['name']
        if result.get('query'):
            kwargs['query'] = result['query']
        if result.get('isDefault'):
            kwargs['is_default'] = result['isDefault']

        if kwargs:
            search.update(**kwargs)

        if result.get('isDefault'):
            SavedSearch.objects.filter(
                project=project,
            ).exclude(id=search_id).update(is_default=False)

        if result.get('isUserDefault'):
            SavedSearchUserDefault.objects.create_or_update(
                user=request.user,
                project=project,
                values={
                    'savedsearch': search,
                }
            )

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
