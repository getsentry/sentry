from __future__ import annotations

from typing import Iterable

from sentry import roles
from sentry.models import OrganizationMember

from .role_based_recipient_strategy import RoleBasedRecipientStrategy


class OwnerRecipientStrategy(RoleBasedRecipientStrategy):
    def determine_member_recipients(self) -> Iterable[OrganizationMember]:
        owners = self.organization.get_members_with_org_roles(
            roles=[roles.get_top_dog().id]
        ).values_list("id", flat=True)

        # Explicitly typing to satisfy mypy.
        members: Iterable[OrganizationMember] = OrganizationMember.get_contactable_members_for_org(
            self.organization.id
        ).filter(id__in=owners)
        self.set_members_roles_in_cache(members, roles.get_top_dog().name)

        return members
