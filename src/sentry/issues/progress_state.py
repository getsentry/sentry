from __future__ import annotations

from enum import StrEnum


class IssueProgressState(StrEnum):
    IDENTIFIED = "identified"
    ASSIGNED = "assigned"
    DIAGNOSED = "diagnosed"
    FIX_PROPOSED = "fix_proposed"
    FIX_APPLIED = "fix_applied"
