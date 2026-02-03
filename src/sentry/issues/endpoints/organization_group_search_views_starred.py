from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.serializers import serialize
from sentry.api.serializers.models.groupsearchviewstarred import GroupSearchViewStarredSerializer
from sentry.models.groupsearchviewstarred import GroupSearchViewStarred
from sentry.models.organization import Organization


class MemberPermission(OrganizationPermission):
    scope_map = {
        "GET": ["member:read"],
    }


@region_silo_endpoint
class OrganizationGroupSearchViewsStarredEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ISSUES
    permission_classes = (MemberPermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Retrieve a list of starred views for the current organization member.
        """

        starred_views = GroupSearchViewStarred.objects.filter(
            organization=organization, user_id=request.user.id
        ).select_related("group_search_view")

        return self.paginate(
            request=request,
            queryset=starred_views,
            order_by="position",
            on_results=lambda x: serialize(
                x,
                request.user,
                serializer=GroupSearchViewStarredSerializer(
                    organization=organization,
                ),
            ),
        )
