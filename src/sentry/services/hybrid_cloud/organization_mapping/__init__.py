from __future__ import annotations

import dataclasses
from abc import abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import TYPE_CHECKING, Any, Dict, List, Mapping, Optional

from django.utils import timezone

from sentry.models.user import User
from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation, stubbed
from sentry.silo import SiloMode

if TYPE_CHECKING:
    from sentry.models import Organization


@dataclass(frozen=True, eq=True)
class APIOrganizationMapping:
    organization_id: int = -1
    slug: str = ""
    region_name: str = ""
    date_created: datetime = timezone.now()
    verified: bool = False
    customer_id: Optional[str] = None


@dataclass
class ApiOrganizationMappingUpdate:
    organization_id: int = -1
    name: str = ""
    customer_id: str = ""
    # Call out explicitly set attributes so that they can handle version drift -- ie, differentiate between an update
    # to None and, not an update.
    set_attributes: List[str] = dataclasses.field(default_factory=list)

    def as_update(self) -> Mapping[str, Any]:
        return {k: getattr(self, k) for k in self.set_attributes if hasattr(self, k)}

    @classmethod
    def from_instance(cls, inst: Organization) -> ApiOrganizationMappingUpdate:
        set_attributes: List[str] = []
        params: Dict[str, Any] = dict(set_attributes=set_attributes, organization_id=inst.id)
        for field in dataclasses.fields(cls):
            if hasattr(inst, field.name) and field.name not in {
                "set_attributes",
                "organization_id",
            }:
                params[field.name] = getattr(inst, field.name, None)
                set_attributes.append(field.name)
        return cls(**params)


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
    def update(self, update: ApiOrganizationMappingUpdate) -> None:
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
