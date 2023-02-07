from __future__ import annotations

from typing import Iterable

from django.db.models import Q

from sentry import roles
from sentry.models import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam

from .role_based_recipient_strategy import RoleBasedRecipientStrategy


class OwnerRecipientStrategy(RoleBasedRecipientStrategy):
    def determine_member_recipients(self) -> Iterable[OrganizationMember]:
        # get owner teams
        owner_teams = self.organization.get_teams_with_org_role(roles=[roles.get_top_dog().id])

        # get owners from owner teams
        owner_team_members = list(
            OrganizationMemberTeam.objects.filter(
                team_id__in=owner_teams,
            ).values_list("organizationmember_id", flat=True)
        )

        # Explicitly typing to satisfy mypy.
        members: Iterable[OrganizationMember] = OrganizationMember.get_contactable_members_for_org(
            self.organization.id
        ).filter(Q(role=roles.get_top_dog().id) | Q(id__in=owner_team_members))
        self.set_members_roles_in_cache(members, roles.get_top_dog().name)

        return members
