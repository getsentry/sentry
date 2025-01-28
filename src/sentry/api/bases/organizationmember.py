from __future__ import annotations

from typing import Any, NotRequired, TypedDict

from rest_framework import serializers
from rest_framework.fields import empty
from rest_framework.request import Request

from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.permissions import StaffPermissionMixin
from sentry.db.models.fields.bounded import BoundedAutoField
from sentry.models.organization import Organization
from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.organizations.services.organization.model import (
    RpcOrganization,
    RpcUserOrganizationContext,
)

from .organization import OrganizationEndpoint, OrganizationPermission


class MemberPermission(OrganizationPermission):
    scope_map = {
        "GET": ["member:read", "member:write", "member:admin"],
        "POST": ["member:write", "member:admin", "member:invite"],
        "PUT": ["member:write", "member:admin"],
        "DELETE": ["member:admin"],
    }

    def has_object_permission(
        self,
        request: Request,
        view: object,
        organization: Organization | RpcOrganization | RpcUserOrganizationContext,
    ) -> bool:
        if not super().has_object_permission(request, view, organization):
            return False

        if request.method != "POST":
            return True

        scopes = request.access.scopes
        is_role_above_member = "member:admin" in scopes or "member:write" in scopes
        if isinstance(organization, RpcUserOrganizationContext):
            organization = organization.organization
        return is_role_above_member or not organization.flags.disable_member_invite


class MemberAndStaffPermission(StaffPermissionMixin, MemberPermission):
    """Allows staff to access member endpoints."""

    pass


class MemberIdField(serializers.IntegerField):
    """
    Allow "me" in addition to integers
    """

    def to_internal_value(self, data):
        if data == "me":
            return data
        return super().to_internal_value(data)

    def run_validation(self, data=empty):
        if data == "me":
            return data
        return super().run_validation(data)


class MemberSerializer(serializers.Serializer):
    id = MemberIdField(min_value=0, max_value=BoundedAutoField.MAX_VALUE, required=True)


class _FilterKwargs(TypedDict):
    organization: Organization
    user_id: NotRequired[int]
    user_is_active: NotRequired[bool]
    id: NotRequired[int | str]
    organization_id: NotRequired[int]
    invite_status: NotRequired[int]


class OrganizationMemberEndpoint(OrganizationEndpoint):
    def convert_args(
        self,
        request: Request,
        organization_id_or_slug: str | int | None = None,
        member_id: str = "me",
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, organization_id_or_slug, *args, **kwargs)

        serializer = MemberSerializer(data={"id": member_id})
        if serializer.is_valid():
            result = serializer.validated_data
            try:
                kwargs["member"] = self._get_member(request, kwargs["organization"], result["id"])
            except OrganizationMember.DoesNotExist:
                raise ResourceDoesNotExist

            return args, kwargs
        else:
            raise ResourceDoesNotExist

    def _get_member(
        self,
        request: Request,
        organization: Organization,
        member_id: int | str,
        invite_status: InviteStatus | None = None,
    ) -> OrganizationMember:
        kwargs: _FilterKwargs = {"organization": organization}

        if member_id == "me":
            kwargs["user_id"] = request.user.id
            kwargs["user_is_active"] = True
        else:
            kwargs["id"] = member_id
            kwargs["organization_id"] = organization.id

        if invite_status:
            kwargs["invite_status"] = invite_status.value

        return OrganizationMember.objects.filter(**kwargs).get()
