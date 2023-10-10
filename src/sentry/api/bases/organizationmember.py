from __future__ import annotations

from typing import Any

from rest_framework import serializers
from rest_framework.request import Request

from sentry.api.exceptions import ResourceDoesNotExist
from sentry.db.models.fields.bounded import BoundedAutoField
from sentry.models.organization import Organization
from sentry.models.organizationmember import InviteStatus, OrganizationMember

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
            kwargs.update(user_id=request.user.id, user_is_active=True)
        else:
            kwargs.update(id=member_id, organization_id=organization.id)

        if invite_status:
            kwargs.update(invite_status=invite_status.value)

        om = OrganizationMember.objects.filter(*args, **kwargs).get()
        return om
