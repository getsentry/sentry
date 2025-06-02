import logging
from enum import Enum

from django.db.models import Count, Q
from rest_framework.response import Response

from sentry.api.paginator import DateTimePaginator, OffsetPaginator
from sentry.api.serializers import serialize
from sentry.db.models.query import in_iexact
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.organizationmember import OrganizationMember
from sentry.models.projectplatform import ProjectPlatform
from sentry.search.utils import tokenize_query
from sentry.users.services.user.service import user_service
from sentry.utils.cursors import Cursor
from sentry.utils.pagination_factory import PaginatorLike

logger = logging.getLogger(__name__)


class SortBy(Enum):
    MEMBERS = "members"
    PROJECTS = "projects"
    DATE_ADDED = "date"


class Show(Enum):
    ALL = "all"


def list_organizations(
    *,
    actor_user_id: int,
    owner_only: bool = False,
    query: str | None = None,
    show: Show | None = None,
    sort_by: SortBy | None = "date",
    cursor: Cursor | None = None,
    per_page: int = 100,
    # actor specific stuff
    actor_is_active_superuser: bool = False,
    actor_organization_id: int | None = None,
    actor_project_id: int | None = None,
):
    """
    Return a list of organizations available to the authenticated session in a region.
    This is particularly useful for requests with a user bound context. For API key-based requests this will only return the organization that belongs to the key.
    """
    queryset = Organization.objects.distinct()

    if actor_project_id is not None:
        queryset = queryset.filter(id=actor_project_id.organization_id)
    elif actor_organization_id is not None:
        queryset = queryset.filter(id=actor_organization_id)

    if owner_only:
        # This is used when closing an account
        # also fetches organizations in which you are a member of an owner team
        queryset = Organization.objects.get_organizations_where_user_is_owner(user_id=actor_user_id)
        org_results = []
        for org in sorted(queryset, key=lambda x: x.name):
            # O(N) query
            org_results.append(
                {"organization": serialize(org), "singleOwner": org.has_single_owner()}
            )

        return Response(org_results)

    elif not (actor_is_active_superuser and show == "all"):
        queryset = queryset.filter(
            id__in=OrganizationMember.objects.filter(user_id=actor_user_id).values("organization")
        )
        if actor_organization_id is not None and queryset.count() > 1:
            # If a token is limited to one organization, this endpoint should only return that one organization
            queryset = queryset.filter(id=actor_organization_id)

    if query:
        tokens = tokenize_query(query)
        for key, value in tokens.items():
            if key == "query":
                query_value = " ".join(value)
                user_ids = {
                    u.id
                    for u in user_service.get_many_by_email(emails=[query_value], is_verified=False)
                }
                queryset = queryset.filter(
                    Q(name__icontains=query_value)
                    | Q(slug__icontains=query_value)
                    | Q(member_set__user_id__in=user_ids)
                )
            elif key == "slug":
                queryset = queryset.filter(in_iexact("slug", value))
            elif key == "email":
                user_ids = {
                    u.id for u in user_service.get_many_by_email(emails=value, is_verified=False)
                }
                queryset = queryset.filter(Q(member_set__user_id__in=user_ids))
            elif key == "platform":
                queryset = queryset.filter(
                    project__in=ProjectPlatform.objects.filter(platform__in=value).values(
                        "project_id"
                    )
                )
            elif key == "id":
                queryset = queryset.filter(id__in=value)
            elif key == "status":
                try:
                    queryset = queryset.filter(
                        status__in=[OrganizationStatus[v.upper()] for v in value]
                    )
                except KeyError:
                    queryset = queryset.none()
            elif key == "member_id":
                queryset = queryset.filter(
                    id__in=OrganizationMember.objects.filter(id__in=value).values("organization")
                )
            else:
                queryset = queryset.none()

    paginator_cls: type[PaginatorLike]
    if sort_by == "members":
        queryset = queryset.annotate(member_count=Count("member_set"))
        order_by = "-member_count"
        paginator_cls = OffsetPaginator
    elif sort_by == "projects":
        queryset = queryset.annotate(project_count=Count("project"))
        order_by = "-project_count"
        paginator_cls = OffsetPaginator
    else:
        order_by = "-date_added"
        paginator_cls = DateTimePaginator

    paginator = paginator_cls()
    cursor_result = paginator.get_result(
        limit=per_page,
        cursor=cursor,
        order_by=order_by,
    )

    # TODO: missing user to serialize
    results = [serialize(org) for org in cursor_result.results]

    return {
        "results": results,
        "cursor": {
            "next": cursor_result.next,
            "prev": cursor_result.prev,
            "hits": cursor_result.hits,
            "max_hits": cursor_result.max_hits,
        },
    }
