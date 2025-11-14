from __future__ import annotations
from typing import int

from .role_based_recipient_strategy import RoleBasedRecipientStrategy


class MemberWriteRoleRecipientStrategy(RoleBasedRecipientStrategy):
    scope = "member:write"
