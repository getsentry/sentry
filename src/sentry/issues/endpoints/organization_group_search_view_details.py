from typing import Any, NotRequired, TypedDict

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.serializers.base import serialize
from sentry.api.serializers.models.groupsearchview import GroupSearchViewSerializer
from sentry.api.serializers.rest_framework.groupsearchview import ViewValidator
from sentry.issues.endpoints.organization_group_search_views import pick_default_project
from sentry.models.groupsearchview import GroupSearchView
from sentry.models.groupsearchviewlastvisited import GroupSearchViewLastVisited
from sentry.models.groupsearchviewstarred import GroupSearchViewStarred
from sentry.models.organization import Organization
from sentry.models.savedsearch import SORT_LITERALS


class GroupSearchViewValidatorResponse(TypedDict):
    id: str
    name: NotRequired[str]
    query: NotRequired[str]
    querySort: NotRequired[SORT_LITERALS]
    projects: NotRequired[list[int]]
    isAllProjects: NotRequired[bool]
    environments: NotRequired[list[str]]
    timeFilters: NotRequired[dict[str, Any]]


class MemberPermission(OrganizationPermission):
    scope_map = {
        "GET": ["member:read"],
        "PUT": ["member:read", "member:write"],
        "DELETE": ["member:read", "member:write"],
    }


@region_silo_endpoint
class OrganizationGroupSearchViewDetailsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ISSUES
    permission_classes = (MemberPermission,)

    def get(self, request: Request, organization: Organization, view_id: str) -> Response:
        """
        Get an issue view for the current organization member.
        """
        if not features.has(
            "organizations:issue-stream-custom-views", organization, actor=request.user
        ):
            return Response(status=status.HTTP_404_NOT_FOUND)

        try:
            view = GroupSearchView.objects.get(id=view_id, organization=organization)
        except GroupSearchView.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        return Response(
            serialize(
                view,
                request.user,
                serializer=GroupSearchViewSerializer(
                    has_global_views=features.has("organizations:global-views", organization),
                    default_project=pick_default_project(organization, request.user),
                    organization=organization,
                ),
            ),
            status=status.HTTP_200_OK,
        )

    def put(self, request: Request, organization: Organization, view_id: str) -> Response:
        """
        Update an issue view for the current organization member.
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

        serializer = ViewValidator(
            data=request.data,
            context={"organization": organization},
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated_data = serializer.validated_data

        view.name = validated_data["name"]
        view.query = validated_data["query"]
        view.query_sort = validated_data["querySort"]
        view.is_all_projects = validated_data["isAllProjects"]
        view.environments = validated_data["environments"]
        view.time_filters = validated_data["timeFilters"]
        view.projects.set(validated_data["projects"])

        view.save()

        has_global_views = features.has("organizations:global-views", organization)
        default_project = None
        if not has_global_views:
            default_project = pick_default_project(organization, request.user)

        return Response(
            serialize(
                view,
                request.user,
                serializer=GroupSearchViewSerializer(
                    has_global_views=has_global_views, default_project=default_project
                ),
            ),
            status=status.HTTP_200_OK,
        )

    def delete(self, request: Request, organization: Organization, view_id: str) -> Response:
        """
        Delete an issue view for the current organization member.
        """
        if not features.has(
            "organizations:issue-stream-custom-views", organization, actor=request.user
        ):
            return Response(status=status.HTTP_404_NOT_FOUND)

        try:
            view = GroupSearchView.objects.get(id=view_id)
        except GroupSearchView.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        # Only view creators and org admins can delete views
        has_delete_access = (
            view.user_id == request.user.id
            or request.access.has_scope("org:admin")
            or request.access.has_scope("team:admin")
        )
        if not has_delete_access:
            return Response(status=status.HTTP_403_FORBIDDEN)

        try:
            GroupSearchViewStarred.objects.clear_starred_view_for_all_members(
                organization=organization, view=view
            )
        except GroupSearchViewStarred.DoesNotExist:
            pass

        try:
            GroupSearchViewLastVisited.objects.filter(
                organization=organization, group_search_view=view
            ).delete()
        except GroupSearchViewLastVisited.DoesNotExist:
            pass

        view.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)
