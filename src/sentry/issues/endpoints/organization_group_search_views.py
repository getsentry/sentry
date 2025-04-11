from django.contrib.auth.models import AnonymousUser
from django.db import IntegrityError, router, transaction
from django.db.models import Count
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import ChainPaginator, OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.groupsearchview import GroupSearchViewSerializer
from sentry.api.serializers.rest_framework.groupsearchview import (
    GroupSearchViewPostValidator,
    GroupSearchViewValidator,
    GroupSearchViewValidatorResponse,
)
from sentry.models.groupsearchview import GroupSearchView, GroupSearchViewVisibility
from sentry.models.groupsearchviewstarred import GroupSearchViewStarred
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.team import Team
from sentry.users.models.user import User


class MemberPermission(OrganizationPermission):
    scope_map = {
        "GET": ["member:read", "member:write"],
        "POST": ["member:read", "member:write"],
        "PUT": ["member:read", "member:write"],
    }


SORT_MAP = {
    "popularity": "popularity",
    "-popularity": "-popularity",
    "visited": "groupsearchviewlastvisited__last_visited",
    "-visited": "-groupsearchviewlastvisited__last_visited",
    "name": "name",
    "-name": "-name",
}


class OrganizationGroupSearchViewGetSerializer(serializers.Serializer[None]):
    createdBy = serializers.ChoiceField(
        choices=("me", "others"),
        required=False,
    )
    sort = serializers.ChoiceField(
        choices=list(SORT_MAP.keys()),
        required=False,
    )


@region_silo_endpoint
class OrganizationGroupSearchViewsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
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
        if not features.has(
            "organizations:issue-stream-custom-views", organization, actor=request.user
        ):
            return Response(status=status.HTTP_404_NOT_FOUND)

        has_global_views = features.has("organizations:global-views", organization)

        serializer = OrganizationGroupSearchViewGetSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        starred_view_ids = GroupSearchViewStarred.objects.filter(
            organization=organization, user_id=request.user.id
        ).values_list("group_search_view_id", flat=True)

        default_project = None
        if not has_global_views:
            default_project = pick_default_project(organization, request.user)
            if default_project is None:
                return Response(
                    status=status.HTTP_400_BAD_REQUEST,
                    data={"detail": "You do not have access to any projects."},
                )

        createdBy = serializer.validated_data.get("createdBy", "me")
        sort = SORT_MAP[serializer.validated_data.get("sort", "-visited")]

        if createdBy == "me":
            starred_query = (
                GroupSearchView.objects.filter(
                    organization=organization,
                    user_id=request.user.id,
                    id__in=starred_view_ids,
                )
                .prefetch_related("projects")
                .annotate(popularity=Count("groupsearchviewstarred"))
                .order_by(sort)
            )
            non_starred_query = (
                GroupSearchView.objects.filter(
                    organization=organization,
                    user_id=request.user.id,
                )
                .exclude(id__in=starred_view_ids)
                .prefetch_related("projects")
                .annotate(popularity=Count("groupsearchviewstarred"))
                .order_by(sort)
            )
        elif createdBy == "others":
            starred_query = (
                GroupSearchView.objects.filter(
                    organization=organization,
                    visibility=GroupSearchViewVisibility.ORGANIZATION,
                    id__in=starred_view_ids,
                )
                .exclude(user_id=request.user.id)
                .prefetch_related("projects")
                .annotate(popularity=Count("groupsearchviewstarred"))
                .order_by(sort)
            )
            non_starred_query = (
                GroupSearchView.objects.filter(
                    organization=organization,
                    visibility=GroupSearchViewVisibility.ORGANIZATION,
                )
                .exclude(user_id=request.user.id)
                .exclude(id__in=starred_view_ids)
                .prefetch_related("projects")
                .annotate(popularity=Count("groupsearchviewstarred"))
                .order_by(sort)
            )

        return self.paginate(
            request=request,
            sources=[starred_query, non_starred_query],
            paginator_cls=ChainPaginator,
            on_results=lambda x: serialize(
                x,
                request.user,
                serializer=GroupSearchViewSerializer(
                    has_global_views=has_global_views,
                    default_project=default_project,
                    organization=organization,
                ),
            ),
        )

    def post(self, request: Request, organization: Organization) -> Response:
        """
        Create a new custom view for the current organization member.
        """
        if not features.has(
            "organizations:issue-stream-custom-views", organization, actor=request.user
        ):
            return Response(status=status.HTTP_404_NOT_FOUND)

        serializer = GroupSearchViewPostValidator(
            data=request.data, context={"organization": organization}
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated_data = serializer.validated_data

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

        has_global_views = features.has("organizations:global-views", organization)
        default_project = pick_default_project(organization, request.user)

        return Response(
            serialize(
                view,
                request.user,
                serializer=GroupSearchViewSerializer(
                    has_global_views=has_global_views,
                    default_project=default_project,
                    organization=organization,
                ),
            ),
            status=status.HTTP_201_CREATED,
        )

    def put(self, request: Request, organization: Organization) -> Response:
        """
        Bulk updates the current organization member's custom views. This endpoint
        will delete any views that are not included in the request, add views if
        they are new, and update existing views if they are included in the request.
        This endpoint is explcititly designed to be used by our frontend.
        """
        if not features.has(
            "organizations:issue-stream-custom-views", organization, actor=request.user
        ):
            return Response(status=status.HTTP_404_NOT_FOUND)

        serializer = GroupSearchViewValidator(
            data=request.data, context={"organization": organization}
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated_data = serializer.validated_data

        try:
            with transaction.atomic(using=router.db_for_write(GroupSearchView)):
                new_view_ids_state = bulk_update_views(
                    organization, request.user.id, validated_data["views"]
                )
        except IntegrityError:
            return Response(status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        new_user_starred_views = (
            GroupSearchView.objects.filter(id__in=new_view_ids_state)
            .prefetch_related("projects")
            .order_by("groupsearchviewstarred__position")
        )

        has_global_views = features.has("organizations:global-views", organization)
        default_project = pick_default_project(organization, request.user)

        return self.paginate(
            request=request,
            queryset=new_user_starred_views,
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(
                x,
                request.user,
                serializer=GroupSearchViewSerializer(
                    has_global_views=has_global_views,
                    default_project=default_project,
                    organization=organization,
                ),
            ),
        )


def bulk_update_views(
    org: Organization, user_id: int, views: list[GroupSearchViewValidatorResponse]
) -> list[int]:
    existing_view_ids = [view["id"] for view in views if "id" in view]

    _delete_missing_views(org, user_id, view_ids_to_keep=existing_view_ids)
    created_view_ids = []
    for idx, view in enumerate(views):
        if "id" not in view:
            created_view_ids.append(_create_view(org, user_id, view, position=idx).id)
        else:
            created_view_ids.append(_update_existing_view(org, user_id, view, position=idx).id)

    return created_view_ids


def _delete_missing_views(org: Organization, user_id: int, view_ids_to_keep: list[str]) -> None:
    GroupSearchView.objects.filter(organization=org, user_id=user_id).exclude(
        id__in=view_ids_to_keep
    ).delete()


def _update_existing_view(
    org: Organization, user_id: int, view: GroupSearchViewValidatorResponse, position: int
) -> GroupSearchView:
    try:
        gsv = GroupSearchView.objects.get(id=view["id"], user_id=user_id)
        gsv.name = view["name"]
        gsv.query = view["query"]
        gsv.query_sort = view["querySort"]
        gsv.is_all_projects = view.get("isAllProjects", False)

        if "projects" in view:
            gsv.projects.set(view["projects"])

        if "environments" in view:
            gsv.environments = view["environments"]

        if "timeFilters" in view:
            gsv.time_filters = view["timeFilters"]

        gsv.save()
        GroupSearchViewStarred.objects.update_or_create(
            organization=org,
            user_id=user_id,
            group_search_view=gsv,
            defaults={
                "position": position,
                "visibility": GroupSearchViewVisibility.ORGANIZATION,
            },
        )
        return gsv
    except GroupSearchView.DoesNotExist:
        # It is possible – though unlikely under normal circumstances – for a view to come in that
        # doesn't exist anymore. If, for example, the user has the issue stream open in separate
        # windows, deletes a view in one window, then updates it in the other before refreshing.
        # In this case, we decide to recreate the tab instead of leaving it deleted.
        return _create_view(org, user_id, view, position)


def _create_view(
    org: Organization, user_id: int, view: GroupSearchViewValidatorResponse, position: int
) -> GroupSearchView:
    gsv = GroupSearchView.objects.create(
        organization=org,
        user_id=user_id,
        name=view["name"],
        query=view["query"],
        query_sort=view["querySort"],
        is_all_projects=view.get("isAllProjects", False),
        environments=view.get("environments", []),
        time_filters=view.get("timeFilters", {"period": "14d"}),
        visibility=GroupSearchViewVisibility.ORGANIZATION,
    )
    if "projects" in view:
        gsv.projects.set(view["projects"] or [])

    GroupSearchViewStarred.objects.create(
        organization=org,
        user_id=user_id,
        group_search_view=gsv,
        position=position,
    )
    return gsv


def pick_default_project(org: Organization, user: User | AnonymousUser) -> int | None:
    user_teams = Team.objects.get_for_user(organization=org, user=user)
    user_team_ids = [team.id for team in user_teams]
    default_user_project = (
        Project.objects.get_for_team_ids(user_team_ids)
        .order_by("slug")
        .values_list("id", flat=True)
        .first()
    )
    return default_user_project
