from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.services.hybrid_cloud.organizationmember_mapping import RpcOrganizationMemberMapping


def serialize_org_member_mapping(
    org_member_mapping: OrganizationMemberMapping,
) -> RpcOrganizationMemberMapping:
    return RpcOrganizationMemberMapping.serialize_by_field_name(org_member_mapping)
