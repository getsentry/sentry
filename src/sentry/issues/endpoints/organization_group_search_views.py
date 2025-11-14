from typing import int, Any

from django.db.models import Count, F, OuterRef, Q, Subquery
from django.db.models.expressions import Combinable
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import ChainPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.groupsearchview import GroupSearchViewSerializer
from sentry.api.serializers.rest_framework.groupsearchview import GroupSearchViewPostValidator
from sentry.models.groupsearchview import GroupSearchView, GroupSearchViewVisibility
from sentry.models.groupsearchviewlastvisited import GroupSearchViewLastVisited
from sentry.models.groupsearchviewstarred import GroupSearchViewStarred
from sentry.models.organization import Organization
from sentry.models.project import Project


class MemberPermission(OrganizationPermission):
    scope_map = {
        "GET": ["member:read", "member:write"],
        "POST": ["member:read", "member:write"],
    }

    def has_object_permission(self, request: Request, view: APIView, obj: Any) -> bool:

        if isinstance(obj, Organization):
            return super().has_object_permission(request, view, obj)

        if isinstance(obj, Project):
            if obj.organization.flags.allow_joinleave:
                return True

            if not request.access.has_project_access(obj):
                return False

            return True
        return False


SORT_MAP: dict[str, str | Combinable] = {
    "popularity": "popularity",
    "-popularity": "-popularity",
    "visited": F("last_visited").asc(nulls_first=True),
    "-visited": F("last_visited").desc(nulls_last=True),
    "name": "name",
    "-name": "-name",
    "created": "date_added",
    "-created": "-date_added",
}


class OrganizationGroupSearchViewGetSerializer(serializers.Serializer[None]):
    createdBy = serializers.ChoiceField(
        choices=("me", "others"),
        required=False,
    )
    sort = serializers.ListField(
        child=serializers.ChoiceField(choices=list(SORT_MAP.keys())),
        required=False,
        default=["-visited"],
    )
    query = serializers.CharField(required=False)

    def validate_query(self, value: str | None) -> str | None:
        return value.strip() if value else None


@region_silo_endpoint
class OrganizationGroupSearchViewsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ISSUES
    permission_classes = (MemberPermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        """
        List the current organization member's custom views
        `````````````````````````````````````````

        Retrieve a list of custom views for the current organization member.
        """
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        serializer = OrganizationGroupSearchViewGetSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        starred_view_ids = GroupSearchViewStarred.objects.filter(
            organization=organization, user_id=request.user.id
        ).values_list("group_search_view_id", flat=True)

        createdBy = serializer.validated_data.get("createdBy", "me")
        sorts = [SORT_MAP[sort] for sort in serializer.validated_data["sort"]]
        query = serializer.validated_data.get("query")
        base_queryset = (
            GroupSearchView.objects.filter(organization=organization)
            if not query
            else GroupSearchView.objects.filter(
                Q(query__icontains=query) | Q(name__icontains=query),
                organization=organization,
            )
        )

        last_visited_query = Subquery(
            GroupSearchViewLastVisited.objects.filter(
                organization=organization,
                user_id=request.user.id,
                group_search_view_id=OuterRef("id"),
            ).values("last_visited")[:1]
        )
        starred_count_query = Count("groupsearchviewstarred")

        if createdBy == "me":
            starred_query = (
                base_queryset.filter(
                    user_id=request.user.id,
                    id__in=starred_view_ids,
                )
                .prefetch_related("projects")
                .annotate(popularity=starred_count_query, last_visited=last_visited_query)
                .order_by(*sorts)
            )
            non_starred_query = (
                base_queryset.filter(
                    user_id=request.user.id,
                )
                .exclude(id__in=starred_view_ids)
                .prefetch_related("projects")
                .annotate(popularity=starred_count_query, last_visited=last_visited_query)
                .order_by(*sorts)
            )
        elif createdBy == "others":
            starred_query = (
                base_queryset.filter(
                    visibility=GroupSearchViewVisibility.ORGANIZATION,
                    id__in=starred_view_ids,
                )
                .exclude(user_id=request.user.id)
                .prefetch_related("projects")
                .annotate(popularity=starred_count_query, last_visited=last_visited_query)
                .order_by(*sorts)
            )
            non_starred_query = (
                base_queryset.filter(
                    visibility=GroupSearchViewVisibility.ORGANIZATION,
                )
                .exclude(user_id=request.user.id)
                .exclude(id__in=starred_view_ids)
                .prefetch_related("projects")
                .annotate(popularity=starred_count_query, last_visited=last_visited_query)
                .order_by(*sorts)
            )

        return self.paginate(
            request=request,
            sources=[starred_query, non_starred_query],
            paginator_cls=ChainPaginator,
            on_results=lambda x: serialize(
                x,
                request.user,
                serializer=GroupSearchViewSerializer(
                    organization=organization,
                ),
            ),
        )

    def post(self, request: Request, organization: Organization) -> Response:
        """
        Create a new custom view for the current organization member.
        """
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        if not features.has("organizations:issue-views", organization, actor=request.user):
            return Response(status=status.HTTP_404_NOT_FOUND)

        serializer = GroupSearchViewPostValidator(
            data=request.data, context={"organization": organization}
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated_data = serializer.validated_data

        projects = Project.objects.filter(
            id__in=validated_data["projects"], organization=organization
        )

        for project in projects:
            self.check_object_permissions(request, project)

        # Create the new view
        view = GroupSearchView.objects.create(
            organization=organization,
            user_id=request.user.id,
            name=validated_data["name"],
            query=validated_data["query"],
            query_sort=validated_data["querySort"],
            is_all_projects=validated_data["isAllProjects"],
            environments=validated_data["environments"],
            time_filters=validated_data["timeFilters"],
            visibility=GroupSearchViewVisibility.ORGANIZATION,
        )
        view.projects.set(validated_data["projects"])

        if validated_data.get("starred"):
            GroupSearchViewStarred.objects.insert_starred_view(
                organization=organization,
                user_id=request.user.id,
                view=view,
            )

        return Response(
            serialize(
                view,
                request.user,
                serializer=GroupSearchViewSerializer(
                    organization=organization,
                ),
            ),
            status=status.HTTP_201_CREATED,
        )
