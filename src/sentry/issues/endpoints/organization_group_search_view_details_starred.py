from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.models.groupsearchview import GroupSearchView, GroupSearchViewVisibility
from sentry.models.groupsearchviewstarred import GroupSearchViewStarred
from sentry.models.organization import Organization


class StarViewSerializer(serializers.Serializer):
    starred = serializers.BooleanField(required=True)
    position = serializers.IntegerField(required=False)

    def validate(self, data):
        if not data["starred"] and "position" in data:
            raise serializers.ValidationError("Position is only allowed when starring a view.")
        return data


class MemberPermission(OrganizationPermission):
    scope_map = {
        "POST": ["member:read", "member:write"],
    }


@region_silo_endpoint
class OrganizationGroupSearchViewDetailsStarredEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ISSUES
    permission_classes = (MemberPermission,)

    def post(self, request: Request, organization: Organization, view_id: int) -> Response:
        """
        Update the starred status of a group search view for the current organization member.
        """
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        serializer = StarViewSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        is_starred = serializer.validated_data["starred"]

        try:
            view = GroupSearchView.objects.get(id=view_id, organization=organization)
        except GroupSearchView.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        if not (
            view.user_id == request.user.id
            or view.visibility == GroupSearchViewVisibility.ORGANIZATION
        ):
            return Response(status=status.HTTP_404_NOT_FOUND)

        if is_starred:
            insert_position = (
                serializer.validated_data["position"]
                if "position" in serializer.validated_data
                else GroupSearchViewStarred.objects.num_starred_views(organization, request.user.id)
            )

            if GroupSearchViewStarred.objects.insert_starred_view(
                organization, request.user.id, view, insert_position
            ):
                return Response(status=status.HTTP_200_OK)
        else:
            if GroupSearchViewStarred.objects.delete_starred_view(
                organization, request.user.id, view
            ):
                return Response(status=status.HTTP_200_OK)

        return Response(status=status.HTTP_204_NO_CONTENT)
