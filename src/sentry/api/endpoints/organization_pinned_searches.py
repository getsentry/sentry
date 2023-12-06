from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPinnedSearchPermission
from sentry.api.serializers import serialize
from sentry.models.savedsearch import SavedSearch, SortOptions, Visibility
from sentry.models.search_common import SearchType

PINNED_SEARCH_NAME = "My Pinned Search"


class OrganizationSearchSerializer(serializers.Serializer):
    type = serializers.IntegerField(required=True)
    query = serializers.CharField(required=True, allow_blank=True)
    sort = serializers.ChoiceField(
        choices=SortOptions.as_choices(), default=SortOptions.DATE, required=False
    )

    def validate_type(self, value):
        try:
            SearchType(value)
        except ValueError as e:
            raise serializers.ValidationError(str(e))
        return value


@region_silo_endpoint
class OrganizationPinnedSearchEndpoint(OrganizationEndpoint):
    owner = ApiOwner.OWNERS_SNUBA
    publish_status = {
        "DELETE": ApiPublishStatus.UNKNOWN,
        "PUT": ApiPublishStatus.UNKNOWN,
    }
    permission_classes = (OrganizationPinnedSearchPermission,)

    def put(self, request: Request, organization) -> Response:
        serializer = OrganizationSearchSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.validated_data
        SavedSearch.objects.create_or_update(
            organization=organization,
            name=PINNED_SEARCH_NAME,
            owner_id=request.user.id,
            type=result["type"],
            visibility=Visibility.OWNER_PINNED,
            values={"query": result["query"], "sort": result["sort"]},
        )
        pinned_search = SavedSearch.objects.get(
            organization=organization,
            owner_id=request.user.id,
            type=result["type"],
            visibility=Visibility.OWNER_PINNED,
        )

        return Response(serialize(pinned_search, request.user), status=201)

    def delete(self, request: Request, organization) -> Response:
        try:
            search_type = SearchType(int(request.data.get("type", 0)))
        except ValueError as e:
            return Response({"detail": "Invalid input for `type`. Error: %s" % str(e)}, status=400)
        SavedSearch.objects.filter(
            organization=organization,
            owner_id=request.user.id,
            type=search_type.value,
            visibility=Visibility.OWNER_PINNED,
        ).delete()
        return Response(status=204)
