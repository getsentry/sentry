import sentry_sdk
from django.contrib.auth.models import AnonymousUser
from django.db import IntegrityError, router, transaction
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.helpers.group_index.validators import ValidationError
from sentry.api.paginator import SequencePaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.groupsearchview import GroupSearchViewSerializer
from sentry.api.serializers.rest_framework.groupsearchview import (
    GroupSearchViewValidator,
    GroupSearchViewValidatorResponse,
)
from sentry.models.groupsearchview import DEFAULT_TIME_FILTER, GroupSearchView
from sentry.models.groupsearchviewstarred import GroupSearchViewStarred
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.savedsearch import SortOptions
from sentry.models.team import Team
from sentry.users.models.user import User

DEFAULT_VIEWS: list[GroupSearchViewValidatorResponse] = [
    {
        "name": "Prioritized",
        "query": "is:unresolved issue.priority:[high, medium]",
        "querySort": SortOptions.DATE.value,
        "position": 0,
        "isAllProjects": False,
        "environments": [],
        "timeFilters": DEFAULT_TIME_FILTER,
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
        if not features.has(
            "organizations:issue-stream-custom-views", organization, actor=request.user
        ):
            return Response(status=status.HTTP_404_NOT_FOUND)

        has_global_views = features.has("organizations:global-views", organization)

        query = GroupSearchView.objects.filter(
            organization=organization, user_id=request.user.id
        ).prefetch_related("projects")

        # Return only the default view(s) if user has no custom views yet
        if not query.exists():
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

        default_project = None
        if not has_global_views:
            default_project = pick_default_project(organization, request.user)
            if default_project is None:
                return Response(
                    status=status.HTTP_400_BAD_REQUEST,
                    data={"detail": "You do not have access to any projects."},
                )

        return self.paginate(
            request=request,
            queryset=query,
            order_by="position",
            on_results=lambda x: serialize(
                x,
                request.user,
                serializer=GroupSearchViewSerializer(
                    has_global_views=has_global_views, default_project=default_project
                ),
            ),
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

        serializer = GroupSearchViewValidator(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated_data = serializer.validated_data

        for view in validated_data["views"]:
            try:
                validate_projects(organization, request.user, view)
            except ValidationError as e:
                sentry_sdk.capture_message(e.args[0])
                return Response(status=status.HTTP_400_BAD_REQUEST, data={"detail": e.args[0]})

        try:
            with transaction.atomic(using=router.db_for_write(GroupSearchView)):
                bulk_update_views(organization, request.user.id, validated_data["views"])
        except IntegrityError as e:
            if (
                len(e.args) > 0
                and 'insert or update on table "sentry_groupsearchviewproject" violates foreign key constraint'
                in e.args[0]
            ):
                sentry_sdk.capture_exception(e)
                return Response(
                    status=status.HTTP_400_BAD_REQUEST,
                    data={"detail": "One or more projects do not exist"},
                )
            return Response(status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        query = GroupSearchView.objects.filter(organization=organization, user_id=request.user.id)

        return self.paginate(
            request=request,
            queryset=query,
            order_by="position",
            on_results=lambda x: serialize(x, request.user, serializer=GroupSearchViewSerializer()),
        )


def validate_projects(
    org: Organization, user: User | AnonymousUser, view: GroupSearchViewValidatorResponse
) -> None:
    if "projects" in view and view["projects"] is not None:
        if not features.has("organizations:global-views", org) and (
            view["projects"] == [-1] or view["projects"] == [] or len(view["projects"]) > 1
        ):
            raise ValidationError("You do not have the multi project stream feature enabled")
        elif view["projects"] == [-1]:
            view["isAllProjects"] = True
            view["projects"] = []
        else:
            view["isAllProjects"] = False


def bulk_update_views(
    org: Organization, user_id: int, views: list[GroupSearchViewValidatorResponse]
) -> None:
    existing_view_ids = [view["id"] for view in views if "id" in view]

    _delete_missing_views(org, user_id, view_ids_to_keep=existing_view_ids)

    for idx, view in enumerate(views):
        if "id" not in view:
            _create_view(org, user_id, view, position=idx)
        else:
            _update_existing_view(org, user_id, view, position=idx)


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


def _delete_missing_views(org: Organization, user_id: int, view_ids_to_keep: list[str]) -> None:
    GroupSearchView.objects.filter(organization=org, user_id=user_id).exclude(
        id__in=view_ids_to_keep
    ).delete()


def _update_existing_view(
    org: Organization, user_id: int, view: GroupSearchViewValidatorResponse, position: int
) -> None:
    try:
        gsv = GroupSearchView.objects.get(id=view["id"], user_id=user_id)
        gsv.name = view["name"]
        gsv.query = view["query"]
        gsv.query_sort = view["querySort"]
        gsv.position = position
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
            defaults={"position": position},
        )
    except GroupSearchView.DoesNotExist:
        # It is possible – though unlikely under normal circumstances – for a view to come in that
        # doesn't exist anymore. If, for example, the user has the issue stream open in separate
        # windows, deletes a view in one window, then updates it in the other before refreshing.
        # In this case, we decide to recreate the tab instead of leaving it deleted.
        _create_view(org, user_id, view, position)


def _create_view(
    org: Organization, user_id: int, view: GroupSearchViewValidatorResponse, position: int
) -> None:
    gsv = GroupSearchView.objects.create(
        organization=org,
        user_id=user_id,
        name=view["name"],
        query=view["query"],
        query_sort=view["querySort"],
        position=position,
        is_all_projects=view.get("isAllProjects", False),
        environments=view.get("environments", []),
        time_filters=view.get("timeFilters", {"period": "14d"}),
    )
    if "projects" in view:
        gsv.projects.set(view["projects"] or [])

    GroupSearchViewStarred.objects.create(
        organization=org,
        user_id=user_id,
        group_search_view=gsv,
        position=position,
    )
