from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.explore.models import ExploreSavedQuery, ExploreSavedQueryStarred
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


@region_silo_endpoint
class ExploreSavedQueryStarredEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.PERFORMANCE
    permission_classes = (MemberPermission,)

    def has_feature(self, organization, request):
        return features.has(
            "organizations:visibility-explore-view", organization, actor=request.user
        )

    def post(self, request: Request, organization: Organization, id: int) -> Response:
        """
        Update the starred status of a saved Explore query for the current organization member.
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
            query = ExploreSavedQuery.objects.get(id=id, organization=organization)
        except ExploreSavedQuery.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        # When unstarring a prebuilt query, we don't delete the starred row from the table.
        # This is because prebuilt queries are lazily starred by default for all users when
        # fetching saved queries for the first time. We need the starred row to exist to
        # prevent the initial lazy-starring from happening again.
        if query.prebuilt_id is not None:
            if ExploreSavedQueryStarred.objects.updated_starred_query(
                organization, request.user.id, query, bool(is_starred)
            ):
                return Response(status=status.HTTP_200_OK)
            else:
                return Response(status=status.HTTP_404_NOT_FOUND)

        if is_starred:
            if ExploreSavedQueryStarred.objects.insert_starred_query(
                organization, request.user.id, query
            ):
                return Response(status=status.HTTP_200_OK)
        else:
            if ExploreSavedQueryStarred.objects.delete_starred_query(
                organization, request.user.id, query
            ):
                return Response(status=status.HTTP_200_OK)

        return Response(status=status.HTTP_204_NO_CONTENT)
