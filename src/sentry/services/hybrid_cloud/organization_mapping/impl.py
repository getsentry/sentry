from dataclasses import fields
from typing import Optional

from django.db import transaction

from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.user import User
from sentry.services.hybrid_cloud.organization_mapping import (
    OrganizationMappingService,
    RpcOrganizationMapping,
    RpcOrganizationMappingUpdate,
)


class DatabaseBackedOrganizationMappingService(OrganizationMappingService):
    def create(
        self,
        *,
        user: User,
        organization_id: int,
        slug: str,
        name: str,
        region_name: str,
        idempotency_key: Optional[str] = "",
        # There's only a customer_id when updating an org slug
        customer_id: Optional[str] = None,
    ) -> RpcOrganizationMapping:

        if idempotency_key:
            org_mapping, _created = OrganizationMapping.objects.update_or_create(
                slug=slug,
                idempotency_key=idempotency_key,
                region_name=region_name,
                defaults={
                    "customer_id": customer_id,
                    "organization_id": organization_id,
                    "name": name,
                },
            )
        else:
            org_mapping = OrganizationMapping.objects.create(
                organization_id=organization_id,
                slug=slug,
                name=name,
                idempotency_key=idempotency_key,
                region_name=region_name,
                customer_id=customer_id,
            )

        return self.serialize_organization_mapping(org_mapping)

    def serialize_organization_mapping(
        self, org_mapping: OrganizationMapping
    ) -> RpcOrganizationMapping:
        args = {
            field.name: getattr(org_mapping, field.name)
            for field in fields(RpcOrganizationMapping)
            if hasattr(org_mapping, field.name)
        }
        return RpcOrganizationMapping(**args)

    def update(self, organization_id: int, update: RpcOrganizationMappingUpdate) -> None:
        with transaction.atomic():
            (
                OrganizationMapping.objects.filter(organization_id=organization_id)
                .select_for_update()
                .update(**update)
            )

    def verify_mappings(self, organization_id: int, slug: str) -> None:
        try:
            mapping = OrganizationMapping.objects.get(organization_id=organization_id, slug=slug)
        except OrganizationMapping.DoesNotExist:
            return

        mapping.update(verified=True, idempotency_key="")

        OrganizationMapping.objects.filter(
            organization_id=organization_id, date_created__lte=mapping.date_created
        ).exclude(slug=slug).delete()

    def delete(self, organization_id: int) -> None:
        OrganizationMapping.objects.filter(organization_id=organization_id).delete()
