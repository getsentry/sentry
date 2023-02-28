from __future__ import annotations

from abc import abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import Optional, cast

from django.utils import timezone

from sentry.models.user import User
from sentry.services.hybrid_cloud import PatchableMixin, Unset, UnsetVal
from sentry.services.hybrid_cloud.rpc import RpcService, rpc_method
from sentry.silo import SiloMode


@dataclass(frozen=True, eq=True)
class RpcOrganizationMapping:
    organization_id: int = -1
    slug: str = ""
    name: str = ""
    region_name: str = ""
    date_created: datetime = timezone.now()
    verified: bool = False
    customer_id: Optional[str] = None


@dataclass
class RpcOrganizationMappingUpdate(PatchableMixin["Organization"]):
    organization_id: int = -1
    name: Unset[str] = UnsetVal
    customer_id: Unset[str] = UnsetVal

    @classmethod
    def from_instance(cls, inst: Organization) -> RpcOrganizationMappingUpdate:
        return cls(**cls.params_from_instance(inst), organization_id=inst.id)


class OrganizationMappingService(RpcService):
    name = "organization_mapping"
    local_mode = SiloMode.CONTROL

    @classmethod
    def get_local_implementation(cls) -> RpcService:
        from sentry.services.hybrid_cloud.organization_mapping.impl import (
            DatabaseBackedOrganizationMappingService,
        )

        return DatabaseBackedOrganizationMappingService()

    @rpc_method
    @abstractmethod
    def create(
        self,
        *,
        user: User,
        organization_id: int,
        slug: str,
        name: str,
        region_name: str,
        idempotency_key: Optional[str] = "",
        customer_id: Optional[str],
    ) -> RpcOrganizationMapping:
        """
        This method returns a new or recreated OrganizationMapping object.
        If a record already exists with the same slug, the organization_id can only be
        updated IF the idempotency key is identical.
        Will raise IntegrityError if the slug already exists.

        :param organization_id:
        The org id to create the slug for
        :param slug:
        A slug to reserve for this organization
        :param customer_id:
        A unique per customer billing identifier
        :return:
        """
        pass

    def close(self) -> None:
        pass

    @rpc_method
    @abstractmethod
    def update(self, update: RpcOrganizationMappingUpdate) -> None:
        pass

    @rpc_method
    @abstractmethod
    def verify_mappings(self, organization_id: int, slug: str) -> None:
        pass

    @rpc_method
    @abstractmethod
    def delete(self, organization_id: int) -> None:
        pass


organization_mapping_service: OrganizationMappingService = cast(
    OrganizationMappingService, OrganizationMappingService.resolve_to_delegation()
)

from sentry.models import Organization
