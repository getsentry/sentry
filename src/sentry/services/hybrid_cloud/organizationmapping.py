from abc import abstractmethod
from typing import Iterable, List, Optional

from sentry.models.options.user_option import OrganizationMapping
from sentry.models.project import Project
from sentry.services.hybrid_cloud import (
    CreateStubFromBase,
    InterfaceWithLifecycle,
    silo_mode_delegation,
)
from sentry.silo import SiloMode


class OrganizationMappingService(InterfaceWithLifecycle):
    @abstractmethod
    def create(
        self,
        as_user_id: int,
        organization_id: int,
        slug: str,
        stripe_id: str,
    ) -> OrganizationMapping:
        """
        This method returns a new or recreated OrganizationMapping object. Will raise if the slug already exists.
        :param organization_id:
        The org id to create the slug for
        :param slug:
        A slug to reserve for this organization
        :param stripe_id:
        A unique per customer stripe identifier
        :return:
        """
        pass


class DatabaseBackedOrganizationMappingService(OrganizationMappingService):
    def get(
        self,
        user_ids: Iterable[int],
        key: str,
        project: Optional[Project],
    ) -> List[OrganizationMapping]:
        queryset = OrganizationMapping.objects.filter(user__in=user_ids, key=key)  # type: ignore
        if project is not None:
            queryset = queryset.filter(project=project)
        return list(queryset)

    def close(self) -> None:
        pass


StubOrganizationMappingService = CreateStubFromBase(DatabaseBackedOrganizationMappingService)

user_option_service: OrganizationMappingService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: lambda: DatabaseBackedOrganizationMappingService(),
        SiloMode.REGION: lambda: StubOrganizationMappingService(),
        SiloMode.CONTROL: lambda: DatabaseBackedOrganizationMappingService(),
    }
)
