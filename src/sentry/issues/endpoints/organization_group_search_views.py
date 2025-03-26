from functools import reduce
from operator import or_

from django.contrib.auth.models import AnonymousUser
from django.db import IntegrityError, router, transaction
from rest_framework import serializers, status
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
    GroupSearchViewStarredSerializer,
)
from sentry.api.serializers.rest_framework.groupsearchview import (
    GroupSearchViewPostValidator,
    GroupSearchViewValidator,
    GroupSearchViewValidatorResponse,
    pick_default_project,
)
from sentry.models.groupsearchview import (
    DEFAULT_TIME_FILTER,
    GroupSearchView,
    GroupSearchViewVisibility,
)
from sentry.models.groupsearchviewlastvisited import GroupSearchViewLastVisited
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
        "POST": ["member:read", "member:write"],
        "PUT": ["member:read", "member:write"],
    }


class OrganizationGroupSearchViewGetSerializer(serializers.Serializer[None]):
    visibility = serializers.MultipleChoiceField(
        choices=GroupSearchViewVisibility.as_choices(),
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
            return Response(serializer.errors, status=400)

        query = GroupSearchView.objects.filter(
            organization=organization, user_id=request.user.id
        ).prefetch_related("projects")

        # Return only the default view(s) if user has no custom views yet
        # TODO(msun): Delete this logic once left-nav views have been fully rolled out.
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

        visibility = serializer.validated_data.get("visibility")
        if visibility:
            org_query = GroupSearchView.objects.filter(
                organization=organization,
                visibility=GroupSearchViewVisibility.ORGANIZATION,
            ).prefetch_related("projects")

            owner_query = GroupSearchView.objects.filter(
                organization=organization,
                user_id=request.user.id,
                visibility=GroupSearchViewVisibility.OWNER,
            ).prefetch_related("projects")

            param_query_map = {
                GroupSearchViewVisibility.ORGANIZATION: org_query,
                GroupSearchViewVisibility.OWNER: owner_query,
            }

            query_list = [param_query_map[v] for v in visibility]
            query = reduce(or_, query_list)

            return self.paginate(
                request=request,
                queryset=query,
                order_by="id",
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

        starred_views = GroupSearchViewStarred.objects.filter(
            organization=organization, user_id=request.user.id
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
                new_view_state = bulk_update_views(
                    organization, request.user.id, validated_data["views"]
                )
        except IntegrityError:
            return Response(status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        last_visited_views = GroupSearchViewLastVisited.objects.filter(
            organization=organization,
            user_id=request.user.id,
            group_search_view_id__in=[view.id for view in new_view_state],
        )
        last_visited_map = {lv.group_search_view_id: lv.last_visited for lv in last_visited_views}

        return self.paginate(
            request=request,
            paginator=SequencePaginator(
                [
                    (
                        idx,
                        {
                            "id": str(view.id),
                            "name": view.name,
                            "query": view.query,
                            "querySort": view.query_sort,
                            "projects": (
                                [-1]
                                if view.is_all_projects
                                else list(view.projects.values_list("id", flat=True))
                            ),
                            "environments": view.environments,
                            "timeFilters": view.time_filters,
                            "dateCreated": view.date_added,
                            "dateUpdated": view.date_updated,
                            "lastVisited": last_visited_map.get(view.id, None),
                            "position": idx,
                        },
                    )
                    for idx, view in enumerate(new_view_state)
                ]
            ),
            on_results=lambda results: serialize(results, request.user),
        )


def bulk_update_views(
    org: Organization, user_id: int, views: list[GroupSearchViewValidatorResponse]
) -> list[GroupSearchView]:
    existing_view_ids = [view["id"] for view in views if "id" in view]

    _delete_missing_views(org, user_id, view_ids_to_keep=existing_view_ids)
    created_views = []
    for idx, view in enumerate(views):
        if "id" not in view:
            created_views.append(_create_view(org, user_id, view, position=idx))
        else:
            created_views.append(_update_existing_view(org, user_id, view, position=idx))

    return created_views


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
            defaults={"position": position},
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
