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
from sentry.api.serializers.rest_framework.groupsearchview import GroupSearchViewRestSerializer
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
        "PUT": ["member:read", "member:write"],
    }


@region_silo_endpoint
class OrganizationGroupSearchViewsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
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

    def put(self, request: Request, organization: Organization) -> Response:
        if not features.has("organizations:issue-stream-custom-views", organization):
            return Response(status=status.HTTP_404_NOT_FOUND)

        serializer = GroupSearchViewRestSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated_data = serializer.validated_data
        bulk_update_views(organization, request.user.id, validated_data)

        query = GroupSearchView.objects.filter(organization=organization, user_id=request.user.id)

        return self.paginate(
            request=request,
            queryset=query,
            order_by="position",
            on_results=lambda x: serialize(x, request.user, serializer=GroupSearchViewSerializer()),
        )


def bulk_update_views(org: Organization, user_id: int, validated_data):
    views = validated_data.get("views")

    existing_view_ids = [view["id"] for view in views if "id" in view]

    _delete_missing_views(org, user_id, view_ids_to_keep=existing_view_ids)

    for idx, view in enumerate(validated_data["views"]):
        if "id" not in view:
            _create_view(org, user_id, view, position=idx)
        else:
            _update_existing_view(view, position=idx)


def _delete_missing_views(org: Organization, user_id: int, view_ids_to_keep: list[int]):
    GroupSearchView.objects.filter(organization=org, user_id=user_id).exclude(
        id__in=view_ids_to_keep
    ).delete()


def _update_existing_view(view: GroupSearchViewSerializerResponse, position: int):
    GroupSearchView.objects.filter(id=view["id"]).update(
        name=view["name"],
        query=view["query"],
        query_sort=view["querySort"],
        position=position,
    )


def _create_view(org: Organization, user_id: int, view, position: int):
    GroupSearchView.objects.create(
        organization=org,
        user_id=user_id,
        name=view["name"],
        query=view["query"],
        query_sort=view["querySort"],
        position=position,
    )
