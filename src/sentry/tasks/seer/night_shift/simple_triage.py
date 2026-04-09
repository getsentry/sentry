from __future__ import annotations

import logging
from collections.abc import Sequence
from dataclasses import dataclass

from django.db.models import F

from sentry.models.group import Group, GroupStatus
from sentry.models.project import Project
from sentry.seer.autofix.utils import is_issue_category_eligible
from sentry.tasks.seer.night_shift.models import TriageAction, TriageResult
from sentry.types.group import PriorityLevel
from sentry.utils.iterators import chunked

logger = logging.getLogger("sentry.tasks.seer.night_shift")

NIGHT_SHIFT_MAX_CANDIDATES = 10
NIGHT_SHIFT_ISSUE_FETCH_LIMIT = 100

# Weights for candidate scoring. Set to 0 to disable a signal.
WEIGHT_FIXABILITY = 1.0
WEIGHT_SEVERITY = 0.0
WEIGHT_TIMES_SEEN = 0.0


@dataclass
class ScoredCandidate(TriageResult):
    """A candidate issue with raw signals for ranking."""

    fixability: float = 0.0
    times_seen: int = 0
    severity: float = 0.0
    action: TriageAction = TriageAction.AUTOFIX

    @property
    def score(self) -> float:
        return (
            WEIGHT_FIXABILITY * self.fixability
            + WEIGHT_SEVERITY * self.severity
            + WEIGHT_TIMES_SEEN * min(self.times_seen / 1000.0, 1.0)
        )

    def __lt__(self, other: ScoredCandidate) -> bool:
        return self.score < other.score


def fixability_score_strategy(
    projects: Sequence[Project],
) -> list[ScoredCandidate]:
    """
    Rank issues by existing fixability score with times_seen as tiebreaker.
    Simple baseline — doesn't require any additional LLM calls.
    """
    all_candidates: list[ScoredCandidate] = []

    for project_id_batch in chunked(projects, 100):
        groups = Group.objects.filter(
            project_id__in=[p.id for p in project_id_batch],
            status=GroupStatus.UNRESOLVED,
            seer_autofix_last_triggered__isnull=True,
            seer_explorer_autofix_last_triggered__isnull=True,
        ).order_by(
            F("seer_fixability_score").desc(nulls_last=True),
            F("times_seen").desc(),
        )[:NIGHT_SHIFT_ISSUE_FETCH_LIMIT]

        for group in groups:
            if not is_issue_category_eligible(group):
                continue

            all_candidates.append(
                ScoredCandidate(
                    group=group,
                    fixability=group.seer_fixability_score or 0.0,
                    times_seen=group.times_seen,
                    severity=(group.priority or 0) / PriorityLevel.HIGH,
                )
            )

    all_candidates.sort(reverse=True)
    return all_candidates[:NIGHT_SHIFT_MAX_CANDIDATES]


def priority_label(priority: int | None) -> str | None:
    if priority is None:
        return None
    return PriorityLevel(priority).name.lower()
