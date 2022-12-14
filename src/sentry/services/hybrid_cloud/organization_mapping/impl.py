from dataclasses import fields
from typing import Any, Optional

from django.db import IntegrityError, transaction

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
        try:
            with transaction.atomic():
                # Creating an identical mapping should succeed, even if a record already exists
                # with this slug. We allow this IFF the idempotency key is identical.
                org_mapping = OrganizationMapping.objects.create(
                    organization_id=organization_id,
                    slug=slug,
                    customer_id=customer_id,
                    idempotency_key=idempotency_key,
                    region_name=region_name,
                )
            return self.serialize_organization_mapping(org_mapping)
        except IntegrityError:
            pass

        # If we got here, the slug already exists
        if idempotency_key != "":
            try:
                with transaction.atomic():
                    existing_mapping = OrganizationMapping.objects.select_for_update().get(
                        slug=slug, idempotency_key=idempotency_key
                    )
                    existing_mapping.update(
                        organization_id=organization_id,
                        customer_id=customer_id,
                        region_name=region_name,
                    )
                return self.serialize_organization_mapping(existing_mapping)
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

    def update_customer_id(self, organization_id: int, customer_id: str) -> Any:
        with transaction.atomic():
            return (
                OrganizationMapping.objects.filter(organization_id=organization_id)
                .select_for_update()
                .update(customer_id=customer_id)
            )
