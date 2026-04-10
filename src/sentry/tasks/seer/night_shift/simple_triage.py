from __future__ import annotations

import logging
from collections.abc import Sequence
from dataclasses import dataclass

from sentry import search
from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.models.group import GroupStatus
from sentry.models.project import Project
from sentry.seer.autofix.utils import is_issue_category_eligible
from sentry.snuba.referrer import Referrer
from sentry.tasks.seer.night_shift.models import TriageAction, TriageResult
from sentry.types.group import PriorityLevel

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
    Fetch top recommended unresolved issues that haven't been triaged by Seer yet,
    then re-rank by fixability score. Doesn't require any additional LLM calls.
    """
    result = search.backend.query(
        projects=projects,
        sort_by="recommended",
        limit=NIGHT_SHIFT_ISSUE_FETCH_LIMIT,
        search_filters=[
            SearchFilter(SearchKey("status"), "=", SearchValue([GroupStatus.UNRESOLVED])),
            SearchFilter(SearchKey("issue.seer_last_run"), "=", SearchValue("")),
        ],
        referrer=Referrer.SEER_NIGHT_SHIFT_FIXABILITY_SCORE_STRATEGY.value,
    )

    logger.info(
        "night_shift.search_results",
        extra={
            "num_projects": len(projects),
            "num_results": len(result.results),
        },
    )

    candidates: list[ScoredCandidate] = []
    for group in result.results:
        if not is_issue_category_eligible(group):
            continue

        candidates.append(
            ScoredCandidate(
                group=group,
                fixability=group.seer_fixability_score or 0.0,
                times_seen=group.times_seen,
                severity=(group.priority or 0) / PriorityLevel.HIGH,
            )
        )

    candidates.sort(reverse=True)
    return candidates[:NIGHT_SHIFT_MAX_CANDIDATES]


def priority_label(priority: int | None) -> str | None:
    if priority is None:
        return None
    try:
        return PriorityLevel(priority).name.lower()
    except ValueError:
        return None
