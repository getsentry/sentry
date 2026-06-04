from sentry.hybridcloud.services.organizationmember_mapping import RpcOrganizationMemberMapping
from sentry.models.organizationmembermapping import OrganizationMemberMapping


def serialize_org_member_mapping(
    org_member_mapping: OrganizationMemberMapping,
) -> RpcOrganizationMemberMapping:
    return RpcOrganizationMemberMapping.serialize_by_field_name(org_member_mapping)
