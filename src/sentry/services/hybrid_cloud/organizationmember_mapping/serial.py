from typing import cast

from sentry.models import OrganizationMemberMapping
from sentry.services.hybrid_cloud.organizationmember_mapping import RpcOrganizationMemberMapping


def serialize_org_member_mapping(
    org_member_mapping: OrganizationMemberMapping,
) -> RpcOrganizationMemberMapping:
    return cast(
        RpcOrganizationMemberMapping,
        RpcOrganizationMemberMapping.serialize_by_field_name(org_member_mapping),
    )
