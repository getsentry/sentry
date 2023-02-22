from __future__ import annotations

from .role_based_recipient_strategy import RoleBasedRecipientStrategy


class MemberWriteRoleRecipientStrategy(RoleBasedRecipientStrategy):
    role = None
    scope = "member:write"
