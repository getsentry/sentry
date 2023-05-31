# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from typing import Any, Optional

from django.conf import settings
from django.db import transaction
from django.db.models import Q

from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.services.hybrid_cloud.organizationmember_mapping import (
    OrganizationMemberMappingService,
    RpcOrganizationMemberMapping,
    RpcOrganizationMemberMappingUpdate,
)
from sentry.services.hybrid_cloud.organizationmember_mapping.serial import (
    serialize_org_member_mapping,
)
from sentry.types.region import get_local_region


class DatabaseBackedOrganizationMemberMappingService(OrganizationMemberMappingService):
    def create_mapping(
        self,
        *,
        organizationmember_id: int,
        organization_id: int,
        role: str,
        user_id: Optional[int] = None,
        email: Optional[str] = None,
        inviter_id: Optional[int] = None,
        invite_status: Optional[int] = None,
    ) -> RpcOrganizationMemberMapping:
        assert (user_id is None and email) or (
            user_id and email is None
        ), "Must set either user or email"
        with transaction.atomic():
            conditions = Q(organizationmember_id=organizationmember_id)
            if user_id is not None:
                conditions = conditions | Q(user_id=user_id)
            else:
                conditions = conditions | Q(email=email)
            query = OrganizationMemberMapping.objects.filter(
                Q(organization_id=organization_id), conditions
            )

            if query.exists():
                org_member_mapping = query.get()
                org_member_mapping.update(
                    organizationmember_id=organizationmember_id,
                    organization_id=organization_id,
                    user_id=user_id,
                    email=email,
                    role=role,
                    inviter_id=inviter_id,
                    invite_status=invite_status,
                )
            else:
                org_member_mapping = OrganizationMemberMapping.objects.create(
                    organizationmember_id=organizationmember_id,
                    organization_id=organization_id,
                    user_id=user_id,
                    email=email,
                    role=role,
                    inviter_id=inviter_id,
                    invite_status=invite_status,
                )
        return serialize_org_member_mapping(org_member_mapping)

    def _find_organization_member(
        self,
        organization_id: int,
        email: Optional[str] = None,
        user_id: Optional[str] = None,
        organizationmember_id: Optional[int] = None,
    ) -> Optional[OrganizationMemberMapping]:
        if user_id is not None:
            return OrganizationMemberMapping.objects.filter(
                organization_id=organization_id, user_id=user_id
            ).first()
        if email is not None:
            return OrganizationMemberMapping.objects.filter(
                organization_id=organization_id, email=email
            ).first()
        if organizationmember_id is not None and _was_monolith():
            return OrganizationMemberMapping.objects.filter(
                organization_id=organization_id, organizationmember_id=organizationmember_id
            ).first()
        return None

    def update_with_organization_member(
        self,
        *,
        organization_id: int,
        rpc_update_org_member: RpcOrganizationMemberMappingUpdate,
        organizationmember_id: Optional[int] = None,
        user_id: Optional[int] = None,
        email: Optional[str] = None,
    ) -> Optional[RpcOrganizationMemberMapping]:
        base_update: Any = dict(
            organization_id=organization_id,
        )

        if _was_monolith() and organizationmember_id:
            base_update["organizationmember_id"] = organizationmember_id

        try:
            org_member_map = self._find_organization_member(
                organization_id=organization_id,
                email=email,
                user_id=user_id,
                organizationmember_id=organizationmember_id,
            )
            if org_member_map:
                return None

            org_member_map.update(**rpc_update_org_member.dict())
            return serialize_org_member_mapping(org_member_map)
        except OrganizationMemberMapping.DoesNotExist:
            return self.create_mapping(
                organizationmember_id=organizationmember_id,
                organization_id=organization_id,
                **rpc_update_org_member.dict(),
            )

    def delete_with_organization_member(
        self,
        *,
        organization_id: int,
        organizationmember_id: Optional[int] = None,
        user_id: Optional[int] = None,
        email: Optional[str] = None,
    ) -> None:
        org_member_map = self._find_organization_member(
            organization_id=organization_id,
            email=email,
            user_id=user_id,
            organizationmember_id=organizationmember_id,
        )
        if org_member_map:
            org_member_map.delete()

    def close(self) -> None:
        pass


def _was_monolith() -> bool:
    if not settings.SENTRY_REGION:
        return True
    return get_local_region().was_monolith
