from sentry.api.bases.organization import OrganizationPermission
from sentry.explore.models import ExploreSavedQuery
from sentry.models.organization import Organization


class ExploreSavedQueryPermission(OrganizationPermission):
    # Relaxed permissions for saved queries in Explore
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "POST": ["org:read", "org:write", "org:admin"],
        "PUT": ["org:read", "org:write", "org:admin"],
        "DELETE": ["org:read", "org:write", "org:admin"],
    }
    readonly_mutation_scope_exceptions = {
        "POST": "Explore saved query mutations remain available for personal or otherwise permitted queries.",
        "PUT": "Explore saved query mutations remain available for personal or otherwise permitted queries.",
        "DELETE": "Explore saved query mutations remain available for personal or otherwise permitted queries.",
    }

    def has_object_permission(self, request, view, obj):
        if isinstance(obj, Organization):
            return super().has_object_permission(request, view, obj)

        if isinstance(obj, ExploreSavedQuery):
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
