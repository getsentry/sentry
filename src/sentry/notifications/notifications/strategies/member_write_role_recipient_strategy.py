from __future__ import annotations

from typing import Iterable

from sentry import roles
from sentry.models import OrganizationMember

from .role_based_recipient_strategy import RoleBasedRecipientStrategy


class MemberWriteRoleRecipientStrategy(RoleBasedRecipientStrategy):
    def determine_member_recipients(self) -> Iterable[OrganizationMember]:
        members: Iterable[
            OrganizationMember
        ] = OrganizationMember.objects.get_contactable_members_for_org(self.organization.id).filter(
            role__in=(r.id for r in roles.get_all() if r.has_scope("member:write")),
        )
        return members
