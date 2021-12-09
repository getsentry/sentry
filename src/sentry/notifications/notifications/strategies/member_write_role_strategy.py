from __future__ import annotations

from typing import Iterable

from sentry import roles
from sentry.models import InviteStatus, OrganizationMember

from .role_based_strategy import RoleBasedStrategy


class MemberWriteRoleStrategy(RoleBasedStrategy):
    def determine_member_recipients(self) -> Iterable[OrganizationMember]:
        members: Iterable[OrganizationMember] = OrganizationMember.objects.select_related(
            "user"
        ).filter(
            organization_id=self.organization.id,
            user__isnull=False,
            invite_status=InviteStatus.APPROVED.value,
            role__in=(r.id for r in roles.get_all() if r.has_scope("member:write")),
        )
        return members
