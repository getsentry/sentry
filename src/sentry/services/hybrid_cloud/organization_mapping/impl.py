from dataclasses import fields
from typing import Any, Optional

from django.db import transaction

from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.user import User
from sentry.services.hybrid_cloud.organization_mapping import (
    APIOrganizationMapping,
    OrganizationMappingService,
)


class DatabaseBackedOrganizationMappingService(OrganizationMappingService):
    def create(
        self,
        *,
        user: User,
        organization_id: int,
        slug: str,
        region_name: str,
        idempotency_key: Optional[str] = "",
        # There's only a customer_id when updating an org slug
        customer_id: Optional[str] = None,
    ) -> APIOrganizationMapping:

        if idempotency_key:
            org_mapping, _created = OrganizationMapping.objects.update_or_create(
                slug=slug,
                idempotency_key=idempotency_key,
                defaults={
                    "customer_id": customer_id,
                    "organization_id": organization_id,
                    "region_name": region_name,
                },
            )
        else:
            org_mapping = OrganizationMapping.objects.create(
                organization_id=organization_id,
                slug=slug,
                idempotency_key=idempotency_key,
                region_name=region_name,
                customer_id=customer_id,
            )

        return self.serialize_organization_mapping(org_mapping)

    def serialize_organization_mapping(
        cls, org_mapping: OrganizationMapping
    ) -> APIOrganizationMapping:
        args = {
            field.name: getattr(org_mapping, field.name)
            for field in fields(APIOrganizationMapping)
            if hasattr(org_mapping, field.name)
        }
        return APIOrganizationMapping(**args)

    def update_customer_id(self, organization_id: int, customer_id: str) -> Any:
        with transaction.atomic():
            return (
                OrganizationMapping.objects.filter(organization_id=organization_id)
                .select_for_update()
                .update(customer_id=customer_id)
            )
