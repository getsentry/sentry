from typing import cast

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
    return cast(RpcOrganizationMapping, RpcOrganizationMapping.serialize_by_field_name(org_mapping))
