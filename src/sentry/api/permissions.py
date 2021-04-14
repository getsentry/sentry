from rest_framework import permissions

from sentry.api.exceptions import SsoRequired, SuperuserRequired, TwoFactorRequired
from sentry.auth import access
from sentry.auth.superuser import is_active_superuser
from sentry.auth.system import is_system_auth
from sentry.utils import auth


class RelayPermission(permissions.BasePermission):
    def has_permission(self, request, view):
        return getattr(request, "relay", None) is not None


class SystemPermission(permissions.BasePermission):
    def has_permission(self, request, view):
        return is_system_auth(request.auth)


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

    scope_map = {"HEAD": (), "GET": (), "POST": (), "PUT": (), "PATCH": (), "DELETE": ()}

    def has_permission(self, request, view):
        # session-based auth has all scopes for a logged in user
        if not getattr(request, "auth", None):
            return request.user.is_authenticated()

        allowed_scopes = set(self.scope_map.get(request.method, []))
        current_scopes = request.auth.get_scopes()
        return any(s in allowed_scopes for s in current_scopes)

    def has_object_permission(self, request, view, obj):
        return False


class SuperuserPermission(permissions.BasePermission):
    def has_permission(self, request, view):
        if is_active_superuser(request):
            return True
        if request.user.is_authenticated() and request.user.is_superuser:
            raise SuperuserRequired
        return False


class SentryPermission(ScopedPermission):
    def is_not_2fa_compliant(self, request, organization):
        return False

    def needs_sso(self, request, organization):
        return False

    def determine_access(self, request, organization):
        from sentry.api.base import logger

        if request.user and request.user.is_authenticated() and request.auth:
            request.access = access.from_request(
                request, organization, scopes=request.auth.get_scopes()
            )

        elif request.auth:
            request.access = access.from_auth(request.auth, organization)

        else:
            request.access = access.from_request(request, organization)

            if auth.is_user_signed_request(request):
                # if the user comes from a signed request
                # we let them pass if sso is enabled
                logger.info(
                    "access.signed-sso-passthrough",
                    extra={"organization_id": organization.id, "user_id": request.user.id},
                )
            elif request.user.is_authenticated():
                # session auth needs to confirm various permissions
                if self.needs_sso(request, organization):

                    logger.info(
                        "access.must-sso",
                        extra={"organization_id": organization.id, "user_id": request.user.id},
                    )

                    raise SsoRequired(organization)

                if self.is_not_2fa_compliant(request, organization):
                    logger.info(
                        "access.not-2fa-compliant",
                        extra={"organization_id": organization.id, "user_id": request.user.id},
                    )
                    raise TwoFactorRequired()
