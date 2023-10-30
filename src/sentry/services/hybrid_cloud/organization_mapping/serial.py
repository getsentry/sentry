from typing import Optional, Tuple

from sentry.models.organization import Organization
from sentry.models.organizationmapping import OrganizationMapping
from sentry.services.hybrid_cloud.organization import RpcOrganizationMappingFlags
from sentry.services.hybrid_cloud.organization_mapping import (
    RpcOrganizationMapping,
    RpcOrganizationMappingUpdate,
)
from sentry.types.region import Region


def update_organization_mapping_from_instance(
    organization: Organization,
    region: Region,
    customer_id: Optional[Tuple[Optional[str]]] = None,
) -> RpcOrganizationMappingUpdate:
    return RpcOrganizationMappingUpdate(
        name=organization.name,
        status=organization.status,
        slug=organization.slug,
        region_name=region.name,
        requires_2fa=bool(organization.flags.require_2fa),
        early_adopter=bool(organization.flags.early_adopter),
        codecov_access=bool(organization.flags.codecov_access),
        disable_shared_issues=bool(organization.flags.disable_shared_issues),
        allow_joinleave=bool(organization.flags.allow_joinleave),
        disable_new_visibility_features=bool(organization.flags.disable_new_visibility_features),
        enhanced_privacy=bool(organization.flags.enhanced_privacy),
        require_email_verification=bool(organization.flags.require_email_verification),
        customer_id=customer_id,
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
        flags=serialize_organization_mapping_flags(org_mapping),
    )


def serialize_organization_mapping_flags(
    org_mapping: OrganizationMapping,
) -> RpcOrganizationMappingFlags:
    return RpcOrganizationMappingFlags(
        early_adopter=org_mapping.early_adopter,
        require_2fa=org_mapping.require_2fa,
        allow_joinleave=org_mapping.allow_joinleave,
        enhanced_privacy=org_mapping.enhanced_privacy,
        disable_shared_issues=org_mapping.disable_shared_issues,
        disable_new_visibility_features=org_mapping.disable_new_visibility_features,
        require_email_verification=org_mapping.require_email_verification,
        codecov_access=org_mapping.codecov_access,
    )
