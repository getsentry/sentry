from typing import Any

from django.db import transaction
from rest_framework import serializers, status
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.models.organization import Organization
from sentry.savedqueries import starred as starred_queries


class MemberPermission(OrganizationPermission):
    scope_map = {
        "PUT": ["member:read", "member:write"],
    }


class SavedQueryRefSerializer(serializers.Serializer[dict[str, Any]]):
    type = serializers.ChoiceField(
        choices=[query_type.value for query_type in starred_queries.SavedQueryType]
    )
    id = serializers.IntegerField()


class SavedQueryStarredOrderSerializer(serializers.Serializer[dict[str, Any]]):
    queries = serializers.ListField(child=SavedQueryRefSerializer(), required=True, min_length=0)

    def validate_queries(self, queries: list[dict[str, Any]]) -> list[dict[str, Any]]:
        refs = [(query["type"], query["id"]) for query in queries]
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
            starred_queries.SavedQueryRef(
                starred_queries.SavedQueryType(query["type"]), query["id"]
            )
            for query in serializer.validated_data["queries"]
        ]

        try:
            with transaction.atomic(using=starred_queries.db_alias()):
                starred_queries.lock_starred_list(organization.id, request.user.id)
                starred_queries.reorder(organization, request.user.id, refs)
        except ValueError:
            raise ParseError("Mismatch between existing and provided starred queries.")

        return Response(status=status.HTTP_204_NO_CONTENT)
