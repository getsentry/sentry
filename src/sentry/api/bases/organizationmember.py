from __future__ import annotations

from typing import Any

from django.db.models import Q
from rest_framework import serializers
from rest_framework.request import Request

from sentry.api.exceptions import ResourceDoesNotExist
from sentry.db.models.fields.bounded import BoundedAutoField
from sentry.models import InviteStatus, Organization, OrganizationMember
from sentry.services.hybrid_cloud.organization import RpcOrganizationMember, organization_service
from sentry.services.hybrid_cloud.user.service import user_service

from .organization import OrganizationEndpoint


class MemberIdField(serializers.IntegerField):
    """
    Allow "me" in addition to integers
    """

    def to_internal_value(self, data):
        if data == "me":
            return data
        return super().to_internal_value(data)

    def run_validation(self, data):
        if data == "me":
            return data
        return super().run_validation(data)


class MemberSerializer(serializers.Serializer):
    id = MemberIdField(min_value=0, max_value=BoundedAutoField.MAX_VALUE, required=True)


class OrganizationMemberEndpoint(OrganizationEndpoint):
    def convert_args(
        self,
        request: Request,
        organization_slug: str,
        member_id: str = "me",
        *args: Any,
        **kwargs: Any,
    ) -> tuple[Any, Any]:
        args, kwargs = super().convert_args(request, organization_slug, *args, **kwargs)

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
        args = []
        kwargs = dict(organization=organization)

        if member_id == "me":
            kwargs.update(user__id=request.user.id, user__is_active=True)
        else:
            args.append(Q(user__is_active=True) | Q(user__isnull=True))
            kwargs.update(id=member_id)

        if invite_status:
            kwargs.update(invite_status=invite_status.value)

        return OrganizationMember.objects.filter(*args, **kwargs).select_related("user").get()


class ControlSiloOrganizationMemberEndpoint(OrganizationEndpoint):
    def convert_args(
        self,
        request: Request,
        organization_slug: str,
        member_id: str = "me",
        *args: Any,
        **kwargs: Any,
    ) -> tuple[Any, Any]:
        args, kwargs = super().convert_args(request, organization_slug, *args, **kwargs)

        serializer = MemberSerializer(data={"id": member_id})
        if serializer.is_valid():
            result = serializer.validated_data
            rpc_member = self._get_member(request, kwargs["organization"], result["id"])
            if not rpc_member:
                raise ResourceDoesNotExist
            kwargs["member"] = rpc_member

            return args, kwargs
        else:
            raise ResourceDoesNotExist

    def _get_member(
        self,
        request: Request,
        organization: Organization,
        member_id: int | str,
        invite_status: InviteStatus | None = None,
    ) -> RpcOrganizationMember | None:

        if member_id == "me":
            user_id = request.user.id
            rpc_member = organization_service.check_membership_by_id(
                organization_id=organization.id, user_id=user_id
            )
            rpc_user = user_service.get_user(user_id=user_id, filter={"is_active": True})
            if not (rpc_member and rpc_user):
                return None
        else:
            rpc_member = organization_service.get_organization_member(
                organization_id=organization.id, organization_member_id=member_id
            )
            if not rpc_member:
                return None

            if rpc_member.user_id is not None:
                rpc_user = user_service.get_user(
                    user_id=rpc_member.user_id, filter={"is_active": True}
                )
                if not rpc_user:
                    return None

        if invite_status:
            if rpc_member.invite_status != invite_status.value:
                return None

        return rpc_member
