from django.db.models import Exists, OuterRef, QuerySet
from rest_framework.request import Request
from rest_framework.views import APIView

from sentry.api.bases.organization import OrganizationPermission
from sentry.auth.principal import is_acting_user, is_owned_by_acting_user
from sentry.discover.models import DiscoverSavedQuery, DiscoverSavedQueryProject
from sentry.models.organization import Organization
from sentry.organizations.services.organization import RpcOrganization, RpcUserOrganizationContext


class DiscoverSavedQueryPermission(OrganizationPermission):
    # Relaxed permissions for saved queries in Discover
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin", "saved_query:read"],
        "POST": ["org:read", "org:write", "org:admin", "saved_query:write"],
        "PUT": ["org:read", "org:write", "org:admin", "saved_query:write"],
        "DELETE": ["org:read", "org:write", "org:admin", "saved_query:write"],
    }

    # saved_query:read and saved_query:write replace org:read in orgs with granular scopes.
    rejects_deprecated_scopes = True

    def has_object_permission(
        self,
        request: Request,
        view: APIView,
        obj: Organization | RpcOrganization | RpcUserOrganizationContext | DiscoverSavedQuery,
    ) -> bool:
        if isinstance(obj, Organization):
            return super().has_object_permission(request, view, obj)

        if isinstance(obj, DiscoverSavedQuery):
            # 1. Saved Query contains certain projects
            if obj.projects.exists():
                return request.access.has_projects_access(obj.projects.all())

            # 2. Saved Query covers all projects or all my projects

            # allow when Open Membership
            if obj.organization.flags.allow_joinleave:
                return True

            # allow for Managers and Owners
            if request.access.has_scope("org:write"):
                return True

            # allow for creator
            if is_acting_user(request.user, obj.created_by_id):
                return True

            return False
        return True


def filter_to_accessible_discover_queries(
    request: Request, queryset: QuerySet[DiscoverSavedQuery]
) -> QuerySet[DiscoverSavedQuery]:
    """
    Filter a ``DiscoverSavedQuery`` queryset to only those rows the request actor can access.

    This mirrors ``DiscoverSavedQueryPermission.has_object_permission`` so that listing endpoints
    return the same set the detail endpoint would allow on a per-row basis.
    """
    access = request.access

    # Open Membership and Managers/Owners can see every saved query in the org.
    if access.has_global_access or access.has_scope("org:write"):
        return queryset

    accessible_project_ids = access.accessible_project_ids

    # Hide queries that reference at least one project the actor can't access.
    has_inaccessible_project = DiscoverSavedQueryProject.objects.filter(
        discover_saved_query_id=OuterRef("id"),
    ).exclude(project_id__in=accessible_project_ids)
    queryset = queryset.exclude(Exists(has_inaccessible_project))

    # For queries that target no projects ("All Projects" / "My Projects"), only show
    # those the actor created — Open Membership and org:write are already short-circuited above.
    has_any_project = DiscoverSavedQueryProject.objects.filter(
        discover_saved_query_id=OuterRef("id"),
    )
    queryset = queryset.filter(
        Exists(has_any_project) | is_owned_by_acting_user(request.user, "created_by_id")
    )

    return queryset
