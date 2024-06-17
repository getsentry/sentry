from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import SequencePaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.groupsearchview import (
    GroupSearchViewSerializer,
    GroupSearchViewSerializerResponse,
)
from sentry.models.groupsearchview import GroupSearchView
from sentry.models.organization import Organization
from sentry.models.savedsearch import SortOptions

DEFAULT_VIEWS: list[GroupSearchViewSerializerResponse] = [
    {
        "id": "",
        "name": "Prioritized",
        "query": "is:unresolved issue.priority:[high, medium]",
        "querySort": SortOptions.DATE.value,
        "position": 0,
        "dateCreated": None,
        "dateUpdated": None,
    }
]


class MemberPermission(OrganizationPermission):
    scope_map = {
        "GET": ["member:read", "member:write"],
    }


@region_silo_endpoint
class OrganizationGroupSearchViewsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ISSUES
    permission_classes = (MemberPermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        """
        List the current organization member's custom views
        `````````````````````````````````````````

        Retrieve a list of custom views for the current organization member.
        """
        if not features.has("organizations:issue-stream-custom-views", organization):
            return Response(status=status.HTTP_404_NOT_FOUND)

        query = GroupSearchView.objects.filter(organization=organization, user_id=request.user.id)

        # Return only the prioritized view if user has no custom views yet
        if not query.exists():
            return self.paginate(
                request=request,
                paginator=SequencePaginator(
                    [(idx, view) for idx, view in enumerate(DEFAULT_VIEWS)]
                ),
                on_results=lambda results: serialize(results, request.user),
            )

        return self.paginate(
            request=request,
            queryset=query,
            order_by="position",
            on_results=lambda x: serialize(x, request.user, serializer=GroupSearchViewSerializer()),
        )
