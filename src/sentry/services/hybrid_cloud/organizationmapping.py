from abc import abstractmethod
from dataclasses import dataclass, fields

from django.db import IntegrityError, transaction
from rest_framework import status

from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.user import User
from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation
from sentry.silo import SiloMode
from sentry.silo.client import ControlSiloClient


@dataclass(frozen=True, eq=True)
class APIOrganizationMapping:
    id: int = -1
    organization_id: int = -1
    slug: str = ""
    region_name: str = ""


class OrganizationMappingService(InterfaceWithLifecycle):
    @abstractmethod
    def create(
        self,
        user: User,
        organization_id: int,
        slug: str,
        stripe_id: str,
        idempotency_key: str,
        region_name: str,
    ) -> APIOrganizationMapping:
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

    # TODO: Implement update that allows setting stripe ID for new orgs


class DatabaseBackedOrganizationMappingService(OrganizationMappingService):
    def create(
        self,
        user: User,
        organization_id: int,
        slug: str,
        stripe_id: str,
        idempotency_key: str,
        region_name: str,
    ) -> APIOrganizationMapping:
        with transaction.atomic():
            try:
                # Creating an identical mapping should succeed, even if a record already exists
                # with this slug. We allow this IFF the idempotency key is identical
                mapping = OrganizationMapping.objects.create(
                    organization_id=organization_id,
                    slug=slug,
                    stripe_id=stripe_id,
                    idempotency_key=idempotency_key,
                    region_name=region_name,
                )
                return self.serialize_organization_mapping(mapping)
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
                existing.region_name = region_name
                existing.save()
                return self.serialize_organization_mapping(existing)
            except OrganizationMapping.DoesNotExist:
                pass
        raise IntegrityError("An organization with this slug already exists.")

    def serialize_organization_mapping(
        cls, org_mapping: OrganizationMapping
    ) -> APIOrganizationMapping:
        args = {
            field.name: getattr(org_mapping, field.name)
            for field in fields(APIOrganizationMapping)
            if hasattr(org_mapping, field.name)
        }
        return APIOrganizationMapping(**args)

    def close(self) -> None:
        pass


class APIBackedOrganizationMappingService(OrganizationMappingService):
    def create(
        self,
        user: User,
        organization_id: int,
        slug: str,
        stripe_id: str,
        idempotency_key: str,
        region_name: str,
    ) -> OrganizationMapping:
        client = ControlSiloClient()
        resp = client.request(
            "POST",
            "/organization-mappings",
            data={
                "organization_id": organization_id,
                "slug": slug,
                "stripe_id": stripe_id,
                "idempotency_key": idempotency_key,
                "region_name": region_name,
            },
            user=user,
            timeout=5,
        )

        if resp.status_code == status.HTTP_409_CONFLICT:
            raise IntegrityError("An organization with this slug already exists.")

    def close(self) -> None:
        pass


organization_mapping_service: OrganizationMappingService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: lambda: DatabaseBackedOrganizationMappingService(),
        SiloMode.REGION: lambda: APIBackedOrganizationMappingService(),
        SiloMode.CONTROL: lambda: DatabaseBackedOrganizationMappingService(),
    }
)
