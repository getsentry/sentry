from django.utils import timezone
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.models.groupsearchview import GroupSearchView
from sentry.models.groupsearchviewlastvisited import GroupSearchViewLastVisited
from sentry.models.organization import Organization


class MemberPermission(OrganizationPermission):
    scope_map = {
        "POST": ["member:read"],
    }


@region_silo_endpoint
class OrganizationGroupSearchViewVisitEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ISSUES
    permission_classes = (MemberPermission,)

    def post(self, request: Request, organization: Organization, view_id: str) -> Response:
        """
        Update the last_visited timestamp for a GroupSearchView for the current organization member.
        """
        if not features.has(
            "organizations:issue-stream-custom-views", organization, actor=request.user
        ):
            return Response(status=status.HTTP_404_NOT_FOUND)

        try:
            view = GroupSearchView.objects.get(id=view_id, organization=organization)
        except GroupSearchView.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        # Create or update the last_visited timestamp
        GroupSearchViewLastVisited.objects.create_or_update(
            organization=organization,
            user_id=request.user.id,
            group_search_view=view,
            values={"last_visited": timezone.now()},
        )

        return Response(status=status.HTTP_204_NO_CONTENT)
