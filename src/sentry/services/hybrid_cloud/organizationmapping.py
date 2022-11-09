from abc import abstractmethod

from django.db import IntegrityError, transaction

from sentry.models.organizationmapping import OrganizationMapping
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
        idempotency_key: str,
    ) -> OrganizationMapping:
        """
        This method returns a new or recreated OrganizationMapping object.
        Will raise IntegrityError if the slug already exists.
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
    def create(
        self,
        as_user_id: int,
        organization_id: int,
        slug: str,
        stripe_id: str,
        idempotency_key: str,
    ) -> OrganizationMapping:
        with transaction.atomic():
            try:
                # Creating an identical mapping should succeed, even if a record already exists
                # with this slug. We allow this IFF the idempotency key is identical
                mapping = OrganizationMapping.objects.create(
                    organization_id=organization_id,
                    slug=slug,
                    stripe_id=stripe_id,
                )
                return mapping
            except IntegrityError:
                pass

        # If we got here, the slug already exists
        if idempotency_key != "":
            try:
                existing = OrganizationMapping.objects.get(
                    slug=slug, idempotency_key=idempotency_key
                )
                existing.organization_id = organization_id
                existing.stripe_id = stripe_id
                existing.save()
                return existing
            except OrganizationMapping.DoesNotExist:
                pass
        raise IntegrityError("An organization with this slug already exists.")

    def close(self) -> None:
        pass


StubOrganizationMappingService = CreateStubFromBase(DatabaseBackedOrganizationMappingService)

organization_mapping_service: OrganizationMappingService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: lambda: DatabaseBackedOrganizationMappingService(),
        SiloMode.REGION: lambda: StubOrganizationMappingService(),
        SiloMode.CONTROL: lambda: DatabaseBackedOrganizationMappingService(),
    }
)
