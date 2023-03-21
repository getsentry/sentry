# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud service classes and data models are
# defined, because we want to reflect on type annotations and avoid forward references.

from abc import abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, TypedDict

from django.utils import timezone

from sentry.models import Organization
from sentry.models.user import User
from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation, stubbed
from sentry.silo import SiloMode


@dataclass(frozen=True, eq=True)
class RpcOrganizationMapping:
    organization_id: int = -1
    slug: str = ""
    name: str = ""
    region_name: str = ""
    date_created: datetime = field(default_factory=timezone.now)
    verified: bool = False
    customer_id: Optional[str] = None


class RpcOrganizationMappingUpdate(TypedDict, total=False):
    """A set of values to be updated on an OrganizationMapping.

    An absent key indicates that the attribute should not be updated. (Compare to a
    `"customer_id": None` entry, which indicates that `customer_id` should be
    overwritten with a null value.)
    """

    name: str
    customer_id: Optional[str]


def update_organization_mapping_from_instance(
    organization: Organization,
) -> RpcOrganizationMappingUpdate:
    attributes = {
        attr_name: getattr(organization, attr_name)
        for attr_name in RpcOrganizationMappingUpdate.__annotations__.keys()
    }
    return RpcOrganizationMappingUpdate(**attributes)  # type: ignore


class OrganizationMappingService(InterfaceWithLifecycle):
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

    @abstractmethod
    def update(self, organization_id: int, update: RpcOrganizationMappingUpdate) -> None:
        pass

    @abstractmethod
    def verify_mappings(self, organization_id: int, slug: str) -> None:
        pass

    @abstractmethod
    def delete(self, organization_id: int) -> None:
        pass


def impl_with_db() -> OrganizationMappingService:
    from sentry.services.hybrid_cloud.organization_mapping.impl import (
        DatabaseBackedOrganizationMappingService,
    )

    return DatabaseBackedOrganizationMappingService()


organization_mapping_service: OrganizationMappingService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: impl_with_db,
        SiloMode.REGION: stubbed(impl_with_db, SiloMode.CONTROL),
        SiloMode.CONTROL: impl_with_db,
    }
)
