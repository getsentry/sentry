from __future__ import annotations

from typing import Iterable

from sentry import roles
from sentry.models import OrganizationMember

from .role_based_recipient_strategy import RoleBasedRecipientStrategy


class OwnerRecipientStrategy(RoleBasedRecipientStrategy):
    def determine_member_recipients(self) -> Iterable[OrganizationMember]:
        # Explicitly typing to satisfy mypy.
        members: Iterable[
            OrganizationMember
        ] = OrganizationMember.objects.get_contactable_members_for_org(self.organization.id).filter(
            role=roles.get_top_dog().id,
        )
        return members
