from __future__ import annotations

import logging
from collections.abc import Sequence
from dataclasses import dataclass

import sentry_sdk

from sentry import search
from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.models.group import GroupStatus
from sentry.models.project import Project
from sentry.seer.autofix.constants import FixabilityScoreThresholds
from sentry.seer.autofix.utils import is_issue_category_eligible
from sentry.snuba.referrer import Referrer
from sentry.tasks.seer.night_shift.models import TriageAction, TriageResult
from sentry.tasks.seer.night_shift.skip_cache import recently_skipped
from sentry.types.group import PriorityLevel

logger = logging.getLogger("sentry.tasks.seer.night_shift")

NIGHT_SHIFT_ISSUE_FETCH_LIMIT = 100
FIXABILITY_SCORE_THRESHOLD = FixabilityScoreThresholds.MEDIUM.value


@dataclass
class ScoredCandidate(TriageResult):
    """A candidate issue with raw signals for ranking."""

    fixability: float | None = None
    times_seen: int = 0
    action: TriageAction = TriageAction.AUTOFIX


def fixability_score_strategy(
    projects: Sequence[Project],
    max_candidates: int,
) -> list[ScoredCandidate]:
    """
    Fetch top recommended unresolved issues that haven't been triaged by Seer yet.
    Issues with a fixability score above the threshold are taken first (sorted by
    fixability), then backfilled with unscored issues in their original recommended
    sort order.
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

    skipped_ids = recently_skipped(g.id for g in result.results)

    logger.info(
        "night_shift.search_results",
        extra={
            "num_projects": len(projects),
            "num_results": len(result.results),
            "num_skip_filtered": len(skipped_ids),
            "num_kept_after_skip_filter": len(result.results) - len(skipped_ids),
        },
    )

    scored: list[ScoredCandidate] = []
    unscored: list[ScoredCandidate] = []
    for group in result.results:
        if group.id in skipped_ids:
            continue
        if not is_issue_category_eligible(group):
            continue

        candidate = ScoredCandidate(
            group=group,
            fixability=group.seer_fixability_score,
            times_seen=group.times_seen,
        )

        if candidate.fixability is None:
            unscored.append(candidate)
        elif candidate.fixability >= FIXABILITY_SCORE_THRESHOLD:
            scored.append(candidate)

    scored.sort(key=lambda c: c.fixability or 0.0, reverse=True)
    selected = (scored + unscored)[:max_candidates]

    for c in selected:
        if c.fixability is not None:
            sentry_sdk.metrics.distribution("night_shift.fixability_score", c.fixability)

    return selected


def priority_label(priority: int | None) -> str | None:
    if priority is None:
        return None
    try:
        return PriorityLevel(priority).name.lower()
    except ValueError:
        return None
