from __future__ import annotations

from typing import TYPE_CHECKING

from rest_framework import permissions
from rest_framework.request import Request

from sentry.api.exceptions import (
    MemberDisabledOverLimit,
    SsoRequired,
    SuperuserRequired,
    TwoFactorRequired,
)
from sentry.auth import access
from sentry.auth.superuser import Superuser, is_active_superuser
from sentry.auth.system import is_system_auth
from sentry.utils import auth

if TYPE_CHECKING:
    from sentry.models.organization import Organization


class RelayPermission(permissions.BasePermission):  # type: ignore[misc]
    def has_permission(self, request: Request, view: object) -> bool:
        return getattr(request, "relay", None) is not None


class SystemPermission(permissions.BasePermission):  # type: ignore[misc]
    def has_permission(self, request: Request, view: object) -> bool:
        return is_system_auth(request.auth)


class NoPermission(permissions.BasePermission):  # type: ignore[misc]
    def has_permission(self, request: Request, view: object) -> bool:
        return False


class ScopedPermission(permissions.BasePermission):  # type: ignore[misc]
    """
    Permissions work depending on the type of authentication:

    - A user inherits permissions based on their membership role. These are
      still dictated as common scopes, but they can't be checked until the
      has_object_permission hook is called.
    - ProjectKeys (legacy) are granted only project based scopes. This
    - APIKeys specify their scope, and work as expected.
    """

    scope_map = {"HEAD": (), "GET": (), "POST": (), "PUT": (), "PATCH": (), "DELETE": ()}

    def has_permission(self, request: Request, view: object) -> bool:
        # session-based auth has all scopes for a logged in user
        if not getattr(request, "auth", None):
            return request.user.is_authenticated  # type: ignore[no-any-return]

        allowed_scopes: set[str] = set(self.scope_map.get(request.method, []))
        current_scopes = request.auth.get_scopes()
        return any(s in allowed_scopes for s in current_scopes)

    def has_object_permission(self, request: Request, view: object, obj: object) -> bool:
        return False


class SuperuserPermission(permissions.BasePermission):  # type: ignore[misc]
    def has_permission(self, request: Request, view: object) -> bool:
        if is_active_superuser(request):
            return True
        if request.user.is_authenticated and request.user.is_superuser:
            raise SuperuserRequired
        return False


class SentryPermission(ScopedPermission):
    def is_not_2fa_compliant(self, request: Request, organization: Organization) -> bool:
        return False

    def needs_sso(self, request: Request, organization: Organization) -> bool:
        return False

    def is_member_disabled_from_limit(self, request: Request, organization: Organization) -> bool:
        return False

    def determine_access(self, request: Request, organization: Organization) -> None:
        from sentry.api.base import logger

        if request.user and request.user.is_authenticated and request.auth:
            request.access = access.from_request(
                request, organization, scopes=request.auth.get_scopes()
            )
            return

        if request.auth:
            request.access = access.from_auth(request.auth, organization)
            return

        request.access = access.from_request(request, organization)

        extra = {"organization_id": organization.id, "user_id": request.user.id}

        if auth.is_user_signed_request(request):
            # if the user comes from a signed request
            # we let them pass if sso is enabled
            logger.info(
                "access.signed-sso-passthrough",
                extra=extra,
            )
        elif request.user.is_authenticated:
            # session auth needs to confirm various permissions
            if self.needs_sso(request, organization):

                logger.info(
                    "access.must-sso",
                    extra=extra,
                )

                after_login_redirect = request.META.get("HTTP_REFERER", "")
                if not auth.is_valid_redirect(
                    after_login_redirect, allowed_hosts=(request.get_host(),)
                ):
                    after_login_redirect = None

                raise SsoRequired(organization, after_login_redirect=after_login_redirect)

            if self.is_not_2fa_compliant(request, organization):
                logger.info(
                    "access.not-2fa-compliant",
                    extra=extra,
                )
                if request.user.is_superuser and organization.id != Superuser.org_id:
                    raise SuperuserRequired()

                raise TwoFactorRequired()

            if self.is_member_disabled_from_limit(request, organization):
                logger.info(
                    "access.member-disabled-from-limit",
                    extra=extra,
                )
                raise MemberDisabledOverLimit(organization)
