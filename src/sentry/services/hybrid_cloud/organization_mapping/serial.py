from sentry.models import Organization, OrganizationMapping
from sentry.services.hybrid_cloud.organization_mapping import (
    RpcOrganizationMapping,
    RpcOrganizationMappingUpdate,
)


def update_organization_mapping_from_instance(
    organization: Organization,
) -> RpcOrganizationMappingUpdate:
    attributes = {
        attr_name: getattr(organization, attr_name)
        for attr_name in RpcOrganizationMappingUpdate.__annotations__.keys()
    }
    return RpcOrganizationMappingUpdate(**attributes)  # type: ignore


def serialize_organization_mapping(org_mapping: OrganizationMapping) -> RpcOrganizationMapping:
    return RpcOrganizationMapping(
        id=org_mapping.organization_id,
        slug=org_mapping.slug,
        name=org_mapping.name,
        region_name=org_mapping.region_name,
        date_created=org_mapping.date_created,
        verified=org_mapping.verified,
        customer_id=org_mapping.customer_id,
    )
