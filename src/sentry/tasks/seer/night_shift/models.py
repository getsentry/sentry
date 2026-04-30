from __future__ import annotations

import enum
from dataclasses import dataclass

from sentry.models.group import Group
from sentry.seer.autofix.constants import FixabilityScoreThresholds


class TriageAction(enum.StrEnum):
    AUTOFIX = "autofix"
    ROOT_CAUSE_ONLY = "root_cause_only"
    SKIP = "skip"

    @classmethod
    def from_fixability_score(cls, score: float) -> TriageAction:
        """3-way collapse of the fixability stopping-point thresholds (see
        `_get_stopping_point_from_fixability`), so a fixability score can be
        compared against an agent verdict on equal footing."""
        if score < FixabilityScoreThresholds.MEDIUM.value:
            return cls.SKIP
        if score < FixabilityScoreThresholds.HIGH.value:
            return cls.ROOT_CAUSE_ONLY
        return cls.AUTOFIX


@dataclass
class TriageResult:
    group: Group
    action: TriageAction = TriageAction.AUTOFIX
    reason: str = ""
