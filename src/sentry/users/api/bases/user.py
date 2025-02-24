from __future__ import annotations

from typing import Any

from django.contrib.auth.models import AnonymousUser
from rest_framework.permissions import BasePermission
from rest_framework.request import Request

from sentry.api.base import Endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.permissions import DemoSafePermission, StaffPermissionMixin
from sentry.auth.services.access.service import access_service
from sentry.auth.superuser import is_active_superuser, superuser_has_permission
from sentry.auth.system import is_system_auth
from sentry.models.organization import OrganizationStatus
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.organizations.services.organization import organization_service
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.users.services.user.service import user_service


class UserPermission(DemoSafePermission):

    def has_object_permission(
        self, request: Request, view: object | None, user: User | RpcUser | None = None
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
        self, request: Request, view: object | None, user: User | RpcUser | None = None
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
