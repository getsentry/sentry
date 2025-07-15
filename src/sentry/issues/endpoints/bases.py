from rest_framework.request import Request
from rest_framework.views import APIView

from sentry.api.bases.organization import OrganizationPermission
from sentry.auth.superuser import is_active_superuser
from sentry.models.groupsearchview import GroupSearchView
from sentry.models.organization import Organization


class GroupSearchViewPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "POST": ["org:read", "org:write", "org:admin"],
        "PUT": ["org:read", "org:write", "org:admin"],
        "DELETE": ["org:read", "org:write", "org:admin"],
    }

    def has_object_permission(self, request: Request, view: APIView, obj: object) -> bool:
        if isinstance(obj, Organization):
            return super().has_object_permission(request, view, obj)

        if isinstance(obj, GroupSearchView):
            # Org members can view or create any GroupSearchView
            if request.method == "GET" or request.method == "POST":
                return True

            # The creator can edit their own GroupSearchView
            # Org owners/managers and superusers may edit any GroupSearchView
            if (
                request.user.id == obj.user_id
                or request.access.has_scope("org:write")
                or is_active_superuser(request)
            ):
                return True

            return False

        return True
