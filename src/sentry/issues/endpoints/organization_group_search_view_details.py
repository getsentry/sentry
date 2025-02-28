from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.models.groupsearchview import GroupSearchView
from sentry.models.groupsearchviewstarred import GroupSearchViewStarred
from sentry.models.organization import Organization


class MemberPermission(OrganizationPermission):
    scope_map = {
        "DELETE": ["member:read", "member:write"],
    }


@region_silo_endpoint
class OrganizationGroupSearchViewDetailsEndpoint(OrganizationEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ISSUES
    permission_classes = (MemberPermission,)

    def delete(self, request: Request, organization: Organization, view_id: str) -> Response:
        """
        Delete an issue view for the current organization member.
        """
        if not features.has(
            "organizations:issue-stream-custom-views", organization, actor=request.user
        ):
            return Response(status=status.HTTP_404_NOT_FOUND)

        try:
            view = GroupSearchView.objects.get(
                id=view_id, organization=organization, user_id=request.user.id
            )
        except GroupSearchView.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        # Check if the view is starred by the current user
        if GroupSearchViewStarred.objects.filter(
            organization=organization, user_id=request.user.id, group_search_view=view
        ).exists():
            return Response(
                {"detail": "Cannot delete a starred view."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        view.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
