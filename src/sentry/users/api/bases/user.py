from __future__ import annotations

from typing import Any

from django.contrib.auth.models import AnonymousUser
from rest_framework.permissions import SAFE_METHODS, BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

from sentry.api.base import Endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.permissions import DemoSafePermission, StaffPermissionMixin
from sentry.auth.services.access.service import access_service
from sentry.auth.superuser import is_active_superuser, superuser_has_permission
from sentry.auth.system import is_system_auth
from sentry.demo_mode.utils import is_demo_mode_enabled, is_demo_user
from sentry.models.organization import OrganizationStatus
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.organizations.services.organization import organization_service
from sentry.seer import agent_token
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.users.services.user.service import user_service


class UserPermission(DemoSafePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        if agent_token.is_agent_auth(request.auth):
            return False
        return super().has_permission(request, view)

    def has_object_permission(
        self, request: Request, view: APIView, user: User | RpcUser | None
    ) -> bool:
        if user is None or request.user.id == user.id:
            return True
        if is_system_auth(request.auth):
            return True
        if request.auth:
            return False

        if is_active_superuser(request):
            # collect admin level permissions (only used when a user is active superuser)
            permissions = access_service.get_permissions_for_user(request.user.id)

            if superuser_has_permission(request, permissions):
                return True

        return False


class UserAndStaffPermission(StaffPermissionMixin, UserPermission):
    """
    Allows staff to access any endpoints this permission is used on. Note that
    UserPermission already includes a check for Superuser
    """


class UserDisplayPreferencesPermission(UserPermission):
    """Lets a Seer agent credential read and write the delegating user's own display
    preferences.

    `UserPermission` rejects agent auth outright, because user endpoints are keyed on a
    `user_id` path param and an agent must never act on another person's account. That
    rejection is lifted here for the display-preferences resource only, and replaced
    with an explicit self-only check against the credential.

    No staff or superuser bypass, unlike `UserAndStaffPermission`: display preferences
    are personal, so there is no operator reason to write somebody else's.

    No scope is required, and there is no `scope_map`. These are one user's own
    settings, which that user already changes with no scope at all — session auth never
    reaches a scope check. Requiring one of a token acting for the same user would be
    stricter than the person it acts for, and there is no scope that expresses "may
    change my own settings": every Sentry scope describes an organization resource.
    Authentication is the requirement, and `has_object_permission` confines every
    caller to their own preferences.
    """

    @staticmethod
    def _demo_blocked(request: Request) -> bool:
        """Mirrors `DemoSafePermission`, which the scope-free check below skips.

        Demo sessions are read-only across the product, and that is a separate rule
        from scopes — dropping the scope requirement must not hand them a write.
        """
        return is_demo_user(request.user) and (
            not is_demo_mode_enabled() or request.method not in SAFE_METHODS
        )

    def has_permission(self, request: Request, view: APIView) -> bool:
        if self._demo_blocked(request):
            return False
        return request.user.is_authenticated

    def has_object_permission(
        self, request: Request, view: APIView, user: User | RpcUser | None
    ) -> bool:
        if self._demo_blocked(request):
            return False
        if user is None:
            return False
        if agent_token.is_agent_auth(request.auth):
            # Compared against the credential rather than `request.user`: agent auth
            # synthesizes `request.user` from the token, so checking one against the
            # other would be circular.
            return request.auth.user_id == user.id
        # Deliberately not `super()`: `UserPermission` lets an active superuser act on
        # another account, which for personal display preferences has no operator use.
        return request.user.id == user.id


class OrganizationUserPermission(UserAndStaffPermission):
    scope_map = {"DELETE": ["member:admin"]}

    def has_org_permission(self, request: Request, user: User | RpcUser | None) -> bool:
        """
        Org can act on a user account, if the user is a member of only one org
        e.g. reset org member's 2FA
        """
        assert user, "User must be provided to get organization permissions"
        organization_id = self._get_single_organization_id(user)
        if organization_id is None:
            return False
        organization = organization_service.get_organization_by_id(
            id=organization_id, user_id=request.user.id
        )
        if not organization:
            return False

        self.determine_access(request, organization)
        assert request.method is not None
        allowed_scopes = set(self.scope_map.get(request.method, []))
        return any(request.access.has_scope(s) for s in allowed_scopes)

    @staticmethod
    def _get_single_organization_id(user: User | RpcUser) -> int | None:
        """If the user is a member of only one active org, return its ID."""

        # Multiple OrganizationMemberMappings are okay if only one
        # of them points to an *active* organization
        membership_ids = OrganizationMemberMapping.objects.filter(user_id=user.id).values_list(
            "organization_id", flat=True
        )

        try:
            org_mapping = OrganizationMapping.objects.get(
                status=OrganizationStatus.ACTIVE, organization_id__in=membership_ids
            )
        except (OrganizationMapping.DoesNotExist, OrganizationMapping.MultipleObjectsReturned):
            return None
        return org_mapping.organization_id

    def has_object_permission(
        self, request: Request, view: APIView, user: User | RpcUser | None = None
    ) -> bool:
        if super().has_object_permission(request, view, user):
            return True
        return self.has_org_permission(request, user)


class UserEndpoint(Endpoint):
    """
    The base endpoint for APIs that deal with Users. Inherit from this class to
    get permission checks and to automatically convert user ID "me" to the
    currently logged in user's ID.
    """

    permission_classes: tuple[type[BasePermission], ...] = (UserPermission,)

    def convert_args(
        self, request: Request, user_id: int | str | None = None, *args: Any, **kwargs: Any
    ) -> Any:
        if user_id == "me":
            if not request.user.is_authenticated:
                raise ResourceDoesNotExist
            user_id = request.user.id

        if user_id is None:
            raise ResourceDoesNotExist

        try:
            user = User.objects.get(id=user_id)
        except (User.DoesNotExist, ValueError):
            raise ResourceDoesNotExist

        self.check_object_permissions(request, user)

        kwargs["user"] = user
        return args, kwargs


class RegionSiloUserEndpoint(Endpoint):
    """
    The base endpoint for APIs that deal with Users but live in the region silo.
    Inherit from this class to get permission checks and to automatically
    convert user ID "me" to the currently logged in user's ID.
    """

    permission_classes = (UserPermission,)

    def convert_args(
        self, request: Request, user_id: int | str | None = None, *args: Any, **kwargs: Any
    ) -> Any:
        user: RpcUser | User | None = None

        if user_id == "me":
            if isinstance(request.user, AnonymousUser) or not request.user.is_authenticated:
                raise ResourceDoesNotExist
            user = request.user
        elif user_id is not None:
            user = user_service.get_user(user_id=int(user_id))

        if not user:
            raise ResourceDoesNotExist

        self.check_object_permissions(request, user)

        kwargs["user"] = user
        return args, kwargs
