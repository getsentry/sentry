from typing import Any

from django.db import transaction
from rb import router
from rest_framework import serializers, status
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.explore import utils
from sentry.explore.models import ExploreSavedQueryStarred
from sentry.explore.types import SavedQueryRef, SavedQueryType
from sentry.models.organization import Organization


class MemberPermission(OrganizationPermission):
    scope_map = {
        "PUT": ["member:read", "member:write"],
    }


class SavedQueryRefSerializer(serializers.Serializer[dict[str, Any]]):
    type = serializers.ChoiceField(choices=[query_type.value for query_type in SavedQueryType])
    query_id = serializers.IntegerField()


class SavedQueryStarredOrderSerializer(serializers.Serializer[dict[str, Any]]):
    queries = serializers.ListField(child=SavedQueryRefSerializer(), required=True, min_length=0)

    def validate_queries(self, queries: list[dict[str, Any]]) -> list[dict[str, Any]]:
        refs = [(query["type"], query["query_id"]) for query in queries]
        if len(refs) != len(set(refs)):
            raise serializers.ValidationError("Single query cannot take up multiple positions")

        return queries


@cell_silo_endpoint
class SavedQueryStarredOrderEndpoint(OrganizationEndpoint):
    """
    Reorder a user's starred saved queries as one list spanning Discover and Explore.
    This is meant to be used over ExploreSavedQueryStarredOrderEndpoint


    Discover and Explore stars share a single ``position``. A payload naming one
    product can permute that product's queries. Thus, send the complete starred list
    to reorder all the queries.

    Currently not exposed in urls.py.
    """

    publish_status = {"PUT": ApiPublishStatus.EXPERIMENTAL}
    owner = ApiOwner.EXPLORE
    permission_classes = (MemberPermission,)

    def has_feature(self, organization: Organization, request: Request) -> bool:
        return features.has(
            "organizations:visibility-explore-view", organization, actor=request.user
        ) and features.has(
            "organizations:discover-queries-in-all-queries", organization, actor=request.user
        )

    def put(self, request: Request, organization: Organization) -> Response:
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        if not self.has_feature(organization, request):
            return self.respond(status=404)

        serializer = SavedQueryStarredOrderSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        refs = [
            SavedQueryRef(SavedQueryType(query["type"]), query["query_id"])
            for query in serializer.validated_data["queries"]
        ]

        try:
            # DiscoverSavedQueryStarred should be in the same db as ExploreSavedQueryStarred.
            with transaction.atomic(using=router.db_for_write(ExploreSavedQueryStarred)):
                utils.reorder_starred_queries(organization, request.user.id, refs)
        except ValueError:
            raise ParseError("Mismatch between existing and provided starred queries.")

        return Response(status=status.HTTP_204_NO_CONTENT)
