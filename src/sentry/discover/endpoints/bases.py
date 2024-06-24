from sentry.api.bases.organization import OrganizationPermission
from sentry.discover.models import DiscoverSavedQuery
from sentry.models.organization import Organization


class DiscoverSavedQueryPermission(OrganizationPermission):
    # Relaxed permissions for saved queries in Discover
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "POST": ["org:read", "org:write", "org:admin"],
        "PUT": ["org:read", "org:write", "org:admin"],
        "DELETE": ["org:read", "org:write", "org:admin"],
    }

    def has_object_permission(self, request, view, obj):
        if isinstance(obj, Organization):
            return super().has_object_permission(request, view, obj)

        if isinstance(obj, DiscoverSavedQuery):
            for project in obj.projects.all():
                if not request.access.has_project_access(project):
                    return False

        return True
