from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.discover.models import DiscoverSavedQuery, DiscoverSavedQueryStarred
from sentry.models.organization import Organization


class StarQuerySerializer(serializers.Serializer):
    starred = serializers.BooleanField(required=True)
    position = serializers.IntegerField(required=False)

    def validate(self, data):
        if not data["starred"] and "position" in data:
            raise serializers.ValidationError("Position is only allowed when starring a query.")
        return data


class MemberPermission(OrganizationPermission):
    scope_map = {
        "POST": ["member:read", "member:write"],
    }


@cell_silo_endpoint
class DiscoverSavedQueryStarredEndpoint(OrganizationEndpoint):
    """
    Star or unstar a single saved Discover query.

    The ``position`` allocated here comes from the sequence shared with Explore stars, so
    this is gated on the migration flag as well: a Discover star is only meaningful once
    Discover queries appear in All Queries alongside Explore ones.
    """

    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.EXPLORE
    permission_classes = (MemberPermission,)

    def has_feature(self, organization, request):
        return features.has(
            "organizations:visibility-explore-view", organization, actor=request.user
        ) and features.has(
            "organizations:discover-queries-in-all-queries", organization, actor=request.user
        )

    def post(self, request: Request, organization: Organization, id: int) -> Response:
        """
        Update the starred status of a saved Discover query for the current organization member.
        """
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        if not self.has_feature(organization, request):
            return self.respond(status=404)

        serializer = StarQuerySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        is_starred = serializer.validated_data["starred"]

        try:
            query = DiscoverSavedQuery.objects.get(id=id, organization=organization)
        except DiscoverSavedQuery.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        if is_starred:
            if DiscoverSavedQueryStarred.objects.insert_starred_query(
                organization, request.user.id, query
            ):
                return Response(status=status.HTTP_200_OK)
        else:
            if DiscoverSavedQueryStarred.objects.delete_starred_query(
                organization, request.user.id, query
            ):
                return Response(status=status.HTTP_200_OK)

        return Response(status=status.HTTP_204_NO_CONTENT)
