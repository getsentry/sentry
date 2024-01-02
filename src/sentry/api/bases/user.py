from __future__ import annotations

from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from typing_extensions import override

from sentry.api.base import Endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.permissions import SentryPermission
from sentry.auth.superuser import is_active_superuser
from sentry.auth.system import is_system_auth
from sentry.models.organization import OrganizationStatus
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.models.user import User
from sentry.services.hybrid_cloud.organization import organization_service
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.services.hybrid_cloud.user.service import user_service


class UserPermission(SentryPermission):
    def has_object_permission(self, request: Request, view, user: User | RpcUser | None = None):
        if user is None or request.user.id == user.id:
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
    def _get_single_organization_id(user) -> int | None:
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

    permission_classes: tuple[type[BasePermission], ...] = (UserPermission,)

    @override
    def convert_args(self, request: Request, user_id: str | None = None, *args, **kwargs):
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

    @override
    def convert_args(self, request: Request, user_id: str | None = None, *args, **kwargs):
        user: RpcUser | User | None = None

        if user_id == "me":
            if not request.user.is_authenticated:
                raise ResourceDoesNotExist
            user = request.user
        elif user_id is not None:
            user = user_service.get_user(user_id=int(user_id))

        if not user:
            raise ResourceDoesNotExist

        self.check_object_permissions(request, user)

        kwargs["user"] = user
        return args, kwargs
