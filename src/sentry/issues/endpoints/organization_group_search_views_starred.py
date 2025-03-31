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
from sentry.api.serializers.models.groupsearchview import GroupSearchViewStarredSerializer
from sentry.api.serializers.rest_framework.groupsearchview import GroupSearchViewValidatorResponse
from sentry.issues.endpoints.organization_group_search_views import pick_default_project
from sentry.models.groupsearchview import DEFAULT_TIME_FILTER
from sentry.models.groupsearchviewstarred import GroupSearchViewStarred
from sentry.models.organization import Organization
from sentry.models.savedsearch import SortOptions

DEFAULT_VIEWS: list[GroupSearchViewValidatorResponse] = [
    {
        "name": "Prioritized",
        "query": "is:unresolved issue.priority:[high, medium]",
        "querySort": SortOptions.DATE.value,
        "position": 0,
        "isAllProjects": False,
        "environments": [],
        "projects": [],
        "timeFilters": DEFAULT_TIME_FILTER,
        "dateCreated": None,
        "dateUpdated": None,
    }
]


class MemberPermission(OrganizationPermission):
    scope_map = {
        "GET": ["member:read", "member:write"],
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
        if not features.has(
            "organizations:issue-stream-custom-views", organization, actor=request.user
        ):
            return Response(status=status.HTTP_404_NOT_FOUND)

        has_global_views = features.has("organizations:global-views", organization)

        default_project = None
        if not has_global_views:
            default_project = pick_default_project(organization, request.user)
            if default_project is None:
                return Response(
                    status=status.HTTP_400_BAD_REQUEST,
                    data={"detail": "You do not have access to any projects."},
                )

        starred_views = GroupSearchViewStarred.objects.filter(
            organization=organization, user_id=request.user.id
        )

        # TODO(msun): Remove when tabbed views are deprecated
        if not starred_views.exists():
            return self.paginate(
                request=request,
                paginator=SequencePaginator(
                    [
                        (
                            idx,
                            {
                                **view,
                                "projects": (
                                    []
                                    if has_global_views
                                    else [pick_default_project(organization, request.user)]
                                ),
                            },
                        )
                        for idx, view in enumerate(DEFAULT_VIEWS)
                    ]
                ),
                on_results=lambda results: serialize(results, request.user),
            )

        return self.paginate(
            request=request,
            queryset=starred_views,
            order_by="position",
            on_results=lambda x: serialize(
                x,
                request.user,
                serializer=GroupSearchViewStarredSerializer(
                    has_global_views=has_global_views,
                    default_project=default_project,
                    organization=organization,
                ),
            ),
        )
