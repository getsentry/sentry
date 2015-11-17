from __future__ import absolute_import

from rest_framework import permissions

from sentry.auth.utils import is_active_superuser
from sentry.models import ProjectKey


class NoPermission(permissions.BasePermission):
    def has_permission(self, request, view):
        return False


class ScopedPermission(permissions.BasePermission):
    """
    Permissions work depending on the type of authentication:

    - A user inherits permissions based on their membership role. These are
      still dictated as common scopes, but they can't be checked until the
      has_object_permission hook is called.
    - ProjectKeys (legacy) are granted only project based scopes. This
    - APIKeys specify their scope, and work as expected.
    """
    scope_map = {
        'HEAD': (),
        'GET': (),
        'POST': (),
        'PUT': (),
        'PATCH': (),
        'DELETE': (),
    }

    def has_permission(self, request, view):
        # session-based auth has all scopes for a logged in user
        if not request.auth:
            return request.user.is_authenticated()

        allowed_scopes = set(self.scope_map.get(request.method, []))
        current_scopes = request.auth.get_scopes()
        return any(s in allowed_scopes for s in current_scopes)

    def has_object_permission(self, request, view, obj):
        return False

    def is_project_key(self, request):
        return isinstance(request.auth, ProjectKey)


class SuperuserPermission(permissions.BasePermission):
    def has_permission(self, request, view):
        if is_active_superuser(request.user):
            return True
        return False
