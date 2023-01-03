from abc import abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Optional

from django.utils import timezone

from sentry.models.user import User
from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation, stubbed
from sentry.silo import SiloMode


@dataclass(frozen=True, eq=True)
class APIOrganizationMapping:
    id: int = -1
    organization_id: int = -1
    slug: str = ""
    region_name: str = ""
    date_created: datetime = timezone.now()
    verified: bool = False
    customer_id: Optional[str] = None


class OrganizationMappingService(InterfaceWithLifecycle):
    @abstractmethod
    def create(
        self,
        *,
        user: User,
        organization_id: int,
        slug: str,
        region_name: str,
        idempotency_key: Optional[str] = "",
        customer_id: Optional[str],
    ) -> APIOrganizationMapping:
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
    def update_customer_id(self, organization_id: int, customer_id: str) -> Any:
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
