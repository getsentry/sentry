from typing import cast

from sentry.models import Organization, OrganizationMapping
from sentry.services.hybrid_cloud.organization_mapping import (
    RpcOrganizationMapping,
    RpcOrganizationMappingUpdate,
)
from sentry.types.region import get_local_region


def update_organization_mapping_from_instance(
    organization: Organization,
) -> RpcOrganizationMappingUpdate:
    return RpcOrganizationMappingUpdate(
        slug=organization.slug,
        region_name=get_local_region().name,
        name=organization.name,
        customer_id=organization.customer_id,
        status=organization.status,
    )


def serialize_organization_mapping(org_mapping: OrganizationMapping) -> RpcOrganizationMapping:
    return cast(RpcOrganizationMapping, RpcOrganizationMapping.serialize_by_field_name(org_mapping))
