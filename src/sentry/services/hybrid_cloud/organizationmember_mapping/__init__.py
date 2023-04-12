# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud service classes and data models are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, TypedDict

from django.utils import timezone
from pydantic.fields import Field

from sentry.models import OrganizationMember
from sentry.services.hybrid_cloud import RpcModel, silo_mode_delegation, stubbed
from sentry.services.hybrid_cloud.rpc import RpcService, rpc_method
from sentry.silo import SiloMode


class RpcOrganizationMemberMapping(RpcModel):
    organization_id: int = -1
    date_added: datetime = Field(default_factory=timezone.now)

    role: str = ""
    user_id: Optional[int] = None
    email: Optional[str] = None
    inviter_id: Optional[int] = None
    invite_status: Optional[int] = None


class RpcOrganizationMemberMappingUpdate(TypedDict, total=False):
    """
    A set of values to be updated on an OrganizationMemberMapping.

    An omitted key indicates that the attribute should not be updated. (Compare to a
    `"user_id": None` entry, which indicates that `user_id` should be
    overwritten with a null value.)
    """

    role: str
    user_id: Optional[int]
    email: Optional[str]
    inviter_id: Optional[int]
    invite_status: Optional[int]


def update_organizationmember_mapping_from_instance(
    organization_member: OrganizationMember,
) -> RpcOrganizationMemberMappingUpdate:
    attributes = {
        attr_name: getattr(organization_member, attr_name)
        for attr_name in RpcOrganizationMemberMappingUpdate.__annotations__.keys()
    }
    return RpcOrganizationMemberMappingUpdate(**attributes)  # type: ignore


class OrganizationMemberMappingService(InterfaceWithLifecycle):
    @abstractmethod
    def create_mapping(
        self,
        *,
        organization_id: int,
        role: str,
        user_id: Optional[int] = None,
        email: Optional[str] = None,
        inviter_id: Optional[int] = None,
        invite_status: Optional[int] = None,
    ) -> RpcOrganizationMemberMapping:
        pass

    @abstractmethod
    def create_with_organization_member(
        self, org_member: OrganizationMember
    ) -> RpcOrganizationMemberMapping:
        pass


def impl_with_db() -> OrganizationMemberMappingService:
    from sentry.services.hybrid_cloud.organizationmember_mapping.impl import (
        DatabaseBackedOrganizationMemberMappingService,
    )

    return DatabaseBackedOrganizationMemberMappingService()


organizationmember_mapping_service: OrganizationMemberMappingService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: impl_with_db,
        SiloMode.REGION: stubbed(impl_with_db, SiloMode.CONTROL),
        SiloMode.CONTROL: impl_with_db,
    }
)
