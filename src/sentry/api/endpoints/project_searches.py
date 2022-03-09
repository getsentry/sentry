from django.db import IntegrityError, transaction
from django.db.models import Q
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint, RelaxedSearchPermission
from sentry.api.serializers import serialize
from sentry.models import SavedSearch, SavedSearchUserDefault
from sentry.signals import save_search_created


class SavedSearchSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=128, required=True)
    query = serializers.CharField(required=True)
    isDefault = serializers.BooleanField(required=False)
    isUserDefault = serializers.BooleanField(required=False)


class ProjectSearchesEndpoint(ProjectEndpoint):
    permission_classes = (RelaxedSearchPermission,)

    def get(self, request: Request, project) -> Response:
        """
        List a project's saved searches

        Retrieve a list of saved searches for a given project.

            {method} {path}

        """
        results = list(
            SavedSearch.objects.filter(
                Q(owner=request.user) | Q(owner__isnull=True), project=project
            ).order_by("name")
        )

        return Response(serialize(results, request.user))

    def post(self, request: Request, project) -> Response:
        """
        Create a new saved search

        Create a new saved search for the given project.

            {method} {path}
            {{
                "name": "Latest Release",
                "query": "release:[latest]"
            }}

        """
        serializer = SavedSearchSerializer(data=request.data)

        if serializer.is_valid():
            result = serializer.validated_data

            with transaction.atomic():
                try:
                    search = SavedSearch.objects.create(
                        project=project,
                        name=result["name"],
                        query=result["query"],
                        is_default=result.get("isDefault", False),
                        owner=(None if request.access.has_scope("project:write") else request.user),
                    )
                    save_search_created.send_robust(project=project, user=request.user, sender=self)

                except IntegrityError:
                    return Response({"detail": "Search with same name already exists."}, status=400)

                if search.is_default:
                    if request.access.has_scope("project:write"):
                        SavedSearch.objects.filter(project=project).exclude(id=search.id).update(
                            is_default=False
                        )
                    else:
                        return Response(
                            {"detail": "User doesn't have permission to set default view"},
                            status=400,
                        )

                if result.get("isUserDefault"):
                    SavedSearchUserDefault.objects.update_or_create(
                        savedsearch=search, user=request.user, project=project
                    )

            return Response(serialize(search, request.user), status=201)
        return Response(serializer.errors, status=400)
