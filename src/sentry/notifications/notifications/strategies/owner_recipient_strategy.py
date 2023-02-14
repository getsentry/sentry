from __future__ import annotations

from sentry import roles

from .role_based_recipient_strategy import RoleBasedRecipientStrategy


class OwnerRecipientStrategy(RoleBasedRecipientStrategy):
    role = roles.get_top_dog()
