from typing import Any

from django.db import IntegrityError, router, transaction
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.auth.principal import require_user
from sentry.explore import utils
from sentry.explore.models import ExploreSavedQueryStarred
from sentry.explore.types import SavedQueryRef, SavedQueryType
from sentry.models.organization import Organization


class MemberPermission(OrganizationPermission):
    scope_map = {
        "PUT": ["member:read", "member:write", "user_preference:write"],
    }

    # user_preference:write replaces member:read in orgs with granular scopes.
    rejects_deprecated_scopes = True


class SavedQueryRefSerializer(serializers.Serializer[dict[str, Any]]):
    type = serializers.ChoiceField(
        choices=[query_type.value for query_type in SavedQueryType],
        help_text="Which product the saved query belongs to.",
    )
    query_id = serializers.IntegerField(help_text="The ID of the starred saved query.")


class SavedQueryStarredOrderSerializer(serializers.Serializer[dict[str, Any]]):
    queries = serializers.ListField(
        child=SavedQueryRefSerializer(),
        required=True,
        min_length=0,
        help_text="The starred saved queries in their new order. Each query may appear only once.",
    )

    def validate_queries(self, queries: list[dict[str, Any]]) -> list[dict[str, Any]]:
        refs = [(query["type"], query["query_id"]) for query in queries]
        if len(refs) != len(set(refs)):
            raise serializers.ValidationError("Single query cannot take up multiple positions")

        return queries


@extend_schema(tags=["Discover"])
@cell_silo_endpoint
class SavedQueryStarredOrderEndpoint(OrganizationEndpoint):
    """
    Reorder a user's starred saved queries as one list spanning Discover and Explore.

    Discover and Explore stars share a single ``position``. A payload containing
    a subset of starred queries will only permute on that subset.
    """

    publish_status = {"PUT": ApiPublishStatus.EXPERIMENTAL}
    idempotent_methods = frozenset({"PUT"})
    owner = ApiOwner.DATA_BROWSING
    permission_classes = (MemberPermission,)

    def has_feature(self, organization: Organization, request: Request) -> bool:
        return features.has(
            "organizations:visibility-explore-view", organization, actor=request.user
        )

    @extend_schema(
        operation_id="Reorder an Organization's Starred Saved Queries",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=SavedQueryStarredOrderSerializer,
        responses={
            204: RESPONSE_NO_CONTENT,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def put(self, request: Request, organization: Organization) -> Response:
        """
        Reorder the starred Discover and Explore saved queries for the member making
        the request. Both products share one starred list. If the payload holds only
        some of the starred queries, only those queries swap positions among themselves.
        """
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
                utils.reorder_starred_queries(organization, require_user(request).id, refs)
        except (IntegrityError, ValueError):
            raise ParseError("Mismatch between existing and provided starred queries.")

        return Response(status=status.HTTP_204_NO_CONTENT)
