from django.db.models import Q
from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPinnedSearchPermission
from sentry.api.serializers import serialize
from sentry.models import SavedSearch, SortOptions
from sentry.models.search_common import SearchType

PINNED_SEARCH_NAME = "My Pinned Search"


class OrganizationSearchSerializer(serializers.Serializer):
    type = serializers.IntegerField(required=True)
    query = serializers.CharField(required=True)
    sort = serializers.ChoiceField(
        choices=SortOptions.as_choices(), default=SortOptions.DATE, required=False
    )

    def validate_type(self, value):
        try:
            SearchType(value)
        except ValueError as e:
            raise serializers.ValidationError(str(e))
        return value


class OrganizationPinnedSearchEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationPinnedSearchPermission,)

    def put(self, request, organization):
        serializer = OrganizationSearchSerializer(data=request.data)

        if serializer.is_valid():
            result = serializer.validated_data
            SavedSearch.objects.create_or_update(
                organization=organization,
                name=PINNED_SEARCH_NAME,
                owner=request.user,
                type=result["type"],
                values={"query": result["query"], "sort": result["sort"]},
            )
            pinned_search = SavedSearch.objects.get(
                organization=organization, owner=request.user, type=result["type"]
            )
            try:
                # If we pinned an existing search, return the details about that
                # search.
                existing_search = SavedSearch.objects.filter(
                    Q(organization=organization, owner__isnull=True) | Q(is_global=True),
                    type=result["type"],
                    query=result["query"],
                    sort=result["sort"],
                )[:1].get()
            except SavedSearch.DoesNotExist:
                pass
            else:
                pinned_search = existing_search
                existing_search.is_pinned = True

            return Response(serialize(pinned_search, request.user), status=201)
        return Response(serializer.errors, status=400)

    def delete(self, request, organization):
        try:
            search_type = SearchType(int(request.data.get("type", 0)))
        except ValueError as e:
            return Response({"detail": "Invalid input for `type`. Error: %s" % str(e)}, status=400)
        SavedSearch.objects.filter(
            organization=organization, owner=request.user, type=search_type.value
        ).delete()
        return Response(status=204)
