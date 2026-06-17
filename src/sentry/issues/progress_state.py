from __future__ import annotations

from enum import StrEnum


class IssueProgressState(StrEnum):
    IDENTIFIED = "identified"
    ASSIGNED = "assigned"
    TRIAGED = "triaged"
    DIAGNOSED = "diagnosed"
    FIX_PROPOSED = "fix_proposed"
    FIX_APPLIED = "fix_applied"
    REGRESSED = "regressed"
