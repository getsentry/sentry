from rest_framework.request import Request

from sentry.api.base import Endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.permissions import SentryPermission
from sentry.auth.superuser import is_active_superuser
from sentry.auth.system import is_system_auth
from sentry.models import Organization, OrganizationStatus, User


class UserPermission(SentryPermission):
    def has_object_permission(self, request: Request, view, user=None):
        if user is None:
            user = request.user
        if request.user == user:
            return True
        if is_system_auth(request.auth):
            return True
        if request.auth:
            return False
        if is_active_superuser(request):
            return True
        return False


class OrganizationUserPermission(UserPermission):
    scope_map = {"DELETE": ["member:admin"]}

    def has_org_permission(self, request: Request, user):
        """
        Org can act on a user account,
        if the user is a member of only one org
        e.g. reset org member's 2FA
        """

        try:
            organization = Organization.objects.get(
                status=OrganizationStatus.VISIBLE, member_set__user=user
            )

            self.determine_access(request, organization)
            allowed_scopes = set(self.scope_map.get(request.method, []))
            return any(request.access.has_scope(s) for s in allowed_scopes)
        except (Organization.DoesNotExist, Organization.MultipleObjectsReturned):
            return False

    def has_object_permission(self, request: Request, view, user=None):
        if super().has_object_permission(request, view, user):
            return True
        return self.has_org_permission(request, user)


class UserEndpoint(Endpoint):
    """
    The base endpoint for APIs that deal with Users. Inherit from this class to
    get permission checks and to automatically convert user ID "me" to the
    currently logged in user's ID.
    """

    permission_classes = (UserPermission,)

    def convert_args(self, request: Request, user_id, *args, **kwargs):
        if user_id == "me":
            if not request.user.is_authenticated:
                raise ResourceDoesNotExist
            user_id = request.user.id

        try:
            user = User.objects.get(id=user_id)
        except (User.DoesNotExist, ValueError):
            raise ResourceDoesNotExist

        self.check_object_permissions(request, user)

        kwargs["user"] = user
        return args, kwargs
