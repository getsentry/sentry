from django.db.models import Exists, OuterRef, Q, QuerySet

from sentry.api.bases.organization import OrganizationPermission
from sentry.explore.models import ExploreSavedQuery, ExploreSavedQueryProject
from sentry.models.organization import Organization


class ExploreSavedQueryPermission(OrganizationPermission):
    # Relaxed permissions for saved queries in Explore
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "POST": ["org:read", "org:write", "org:admin"],
        "PUT": ["org:read", "org:write", "org:admin"],
        "DELETE": ["org:read", "org:write", "org:admin"],
    }

    def has_object_permission(self, request, view, obj):
        if isinstance(obj, Organization):
            return super().has_object_permission(request, view, obj)

        if isinstance(obj, ExploreSavedQuery):
            # Prebuilt queries are product-level content with no user data; any org member
            # should be able to see and open them regardless of project access.
            if obj.prebuilt_id is not None:
                return True

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
            if request.user.id == obj.created_by_id:
                return True

            return False
        return True


def filter_to_accessible_explore_queries(
    request, queryset: QuerySet[ExploreSavedQuery]
) -> QuerySet[ExploreSavedQuery]:
    """
    Filter an ``ExploreSavedQuery`` queryset to only those rows the request actor can access.

    This mirrors ``ExploreSavedQueryPermission.has_object_permission`` so that listing endpoints
    return the same set the detail endpoint would allow on a per-row basis.
    """
    access = request.access

    # Open Membership and Managers/Owners can see every saved query in the org.
    if access.has_global_access or access.has_scope("org:write"):
        return queryset

    accessible_project_ids = access.accessible_project_ids

    # Prebuilt queries are product-level content and bypass project access in
    # `has_object_permission`; the queryset filter must do the same.
    is_prebuilt = Q(prebuilt_id__isnull=False)

    # Hide non-prebuilt queries that reference at least one project the actor can't access.
    has_inaccessible_project = ExploreSavedQueryProject.objects.filter(
        explore_saved_query_id=OuterRef("id"),
    ).exclude(project_id__in=accessible_project_ids)
    queryset = queryset.exclude(Q(Exists(has_inaccessible_project)) & ~is_prebuilt)

    # For non-prebuilt queries that target no projects ("All Projects" / "My Projects"),
    # only show those the actor created. Open Membership and org:write are already
    # short-circuited above.
    has_any_project = ExploreSavedQueryProject.objects.filter(
        explore_saved_query_id=OuterRef("id"),
    )
    queryset = queryset.filter(
        Exists(has_any_project) | Q(created_by_id=request.user.id) | is_prebuilt
    )

    return queryset
