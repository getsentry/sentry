from __future__ import annotations

from typing import Iterable

from sentry import roles
from sentry.models import OrganizationMember

from .role_based_recipient_strategy import RoleBasedRecipientStrategy


class MemberWriteRoleRecipientStrategy(RoleBasedRecipientStrategy):
    def determine_member_recipients(self) -> Iterable[OrganizationMember]:
        valid_roles = (r.id for r in roles.get_all() if r.has_scope("member:write"))

        members = self.organization.get_members_with_org_roles(roles=valid_roles).values_list(
            "id", flat=True
        )
        members: Iterable[
            OrganizationMember
        ] = OrganizationMember.objects.get_contactable_members_for_org(self.organization.id).filter(
            id__in=members,
        )

        for member in members:
            # member:write is either manager or owner role, which must be the first role in the sorted list
            # if a member is an owner and manager we return owner
            self.member_role_by_user_id[member.id] = member.get_all_org_roles_sorted()[0].name

        return members
