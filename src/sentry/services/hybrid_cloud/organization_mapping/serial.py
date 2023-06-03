from typing import cast

from sentry.models import Organization, OrganizationMapping
from sentry.services.hybrid_cloud.organization_mapping import (
    RpcOrganizationMapping,
    RpcOrganizationMappingUpdate,
)
from sentry.types.region import Region


def update_organization_mapping_from_instance(
    organization: Organization,
    region: Region,
) -> RpcOrganizationMappingUpdate:
    return RpcOrganizationMappingUpdate(
        name=organization.name,
        customer_id=organization.customer_id,
        status=organization.status,
        slug=organization.slug,
        region_name=region.name,
    )


def serialize_organization_mapping(org_mapping: OrganizationMapping) -> RpcOrganizationMapping:
    return cast(RpcOrganizationMapping, RpcOrganizationMapping.serialize_by_field_name(org_mapping))
