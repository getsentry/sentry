from __future__ import annotations

from typing import Iterable

from django.db.models import Q

from sentry import roles
from sentry.models import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam

from .role_based_recipient_strategy import RoleBasedRecipientStrategy


class MemberWriteRoleRecipientStrategy(RoleBasedRecipientStrategy):
    def determine_member_recipients(self) -> Iterable[OrganizationMember]:
        valid_roles = (r.id for r in roles.get_all() if r.has_scope("member:write"))
        teams = self.organization.get_teams_with_org_role(roles=valid_roles)
        team_members = list(
            OrganizationMemberTeam.objects.filter(
                team_id__in=teams,
            ).values_list("organizationmember_id", flat=True)
        )
        members: Iterable[
            OrganizationMember
        ] = OrganizationMember.objects.get_contactable_members_for_org(self.organization.id).filter(
            Q(role__in=valid_roles) | Q(id__in=team_members),
        )

        for member in members:
            # member:write is either manager or owner role, which must be the first role in the sorted list
            # if a member is an owner and manager we return owner
            self.member_role_by_user_id[member.id] = member.get_all_org_roles_sorted()[0].name

        return members
