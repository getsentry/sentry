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
        status=organization.status,
        slug=organization.slug,
        region_name=region.name,
    )


def serialize_organization_mapping(org_mapping: OrganizationMapping) -> RpcOrganizationMapping:
    return RpcOrganizationMapping(
        id=org_mapping.organization_id,
        slug=org_mapping.slug,
        name=org_mapping.name,
        region_name=org_mapping.region_name,
        date_created=org_mapping.date_created,
        customer_id=org_mapping.customer_id,
        status=org_mapping.status,
    )
