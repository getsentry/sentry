from django.db import IntegrityError, router, transaction
from rest_framework import serializers, status
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.explore.models import ExploreSavedQueryStarred
from sentry.explore.types import SavedQueryRef, SavedQueryType
from sentry.explore.utils import reorder_starred_queries
from sentry.models.organization import Organization


class MemberPermission(OrganizationPermission):
    scope_map = {
        "PUT": ["member:read", "member:write"],
    }


class ExploreSavedQueryStarredOrderSerializer(serializers.Serializer):
    query_ids = serializers.ListField(child=serializers.IntegerField(), required=True, min_length=0)

    def validate_query_ids(self, query_ids):
        if len(query_ids) != len(set(query_ids)):
            raise serializers.ValidationError("Single query cannot take up multiple positions")

        return query_ids


@cell_silo_endpoint
class ExploreSavedQueryStarredOrderEndpoint(OrganizationEndpoint):
    publish_status = {"PUT": ApiPublishStatus.EXPERIMENTAL}
    owner = ApiOwner.EXPLORE
    permission_classes = (MemberPermission,)

    def has_feature(self, organization, request):
        return features.has(
            "organizations:visibility-explore-view", organization, actor=request.user
        )

    def has_migrate_feature(self, organization, request):
        return features.has(
            "organizations:discover-queries-in-all-queries", organization, actor=request.user
        )

    def put(self, request: Request, organization: Organization) -> Response:
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        if not self.has_feature(organization, request):
            return self.respond(status=404)

        serializer = ExploreSavedQueryStarredOrderSerializer(
            data=request.data, context={"organization": organization, "user": request.user}
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        query_ids = serializer.validated_data["query_ids"]

        try:
            with transaction.atomic(using=router.db_for_write(ExploreSavedQueryStarred)):
                # This is for transitioning from this endpoint to the new SavedQueryStarredEndpoint
                if self.has_migrate_feature(organization, request):
                    refs = [
                        SavedQueryRef(SavedQueryType.EXPLORE, query_id) for query_id in query_ids
                    ]
                    reorder_starred_queries(organization, request.user.id, refs)
                else:
                    ExploreSavedQueryStarred.objects.reorder_starred_queries(
                        organization=organization,
                        user_id=request.user.id,
                        new_query_positions=query_ids,
                    )
        except (IntegrityError, ValueError):
            raise ParseError("Mismatch between existing and provided starred queries.")

        return Response(status=status.HTTP_204_NO_CONTENT)
