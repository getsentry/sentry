from __future__ import annotations

import logging
from collections.abc import Sequence
from dataclasses import dataclass

import sentry_sdk

from sentry import search
from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.issues.search import group_types_from
from sentry.models.group import GroupStatus
from sentry.models.project import Project
from sentry.processing_errors.grouptype import LowValueSpanConfigurationType
from sentry.seer.autofix.constants import FixabilityScoreThresholds
from sentry.seer.autofix.utils import is_issue_category_eligible
from sentry.snuba.referrer import Referrer
from sentry.tasks.seer.night_shift.models import TriageAction, TriageResult
from sentry.tasks.seer.night_shift.skip_cache import recently_skipped
from sentry.types.group import PriorityLevel
from sentry.utils.cursors import Cursor

logger = logging.getLogger("sentry.tasks.seer.night_shift")

NIGHT_SHIFT_ISSUE_FETCH_LIMIT = 100
# Scales the per-project fetch limit instead of using the flat limit above.
NIGHT_SHIFT_PER_PROJECT_FETCH_MULTIPLIER = 3
# Skipped issues can't be filtered at query time, so we page past them. At
# defaults (2 runs/day x 10 candidates, skips expire after 7.5d) live skips
# plateau at ~150 (~1.5 pages), so 10 pages leaves ample headroom.
# The per-project path uses a smaller page (~30) but spreads skips across
# projects, so its per-project window stays well clear too.
NIGHT_SHIFT_MAX_SEARCH_PAGES = 10
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
    """Scores candidates across all projects combined — a busy project can eat
    the whole max_candidates budget. See fixability_score_strategy_per_project."""
    return _fetch_and_score(projects, max_candidates, NIGHT_SHIFT_ISSUE_FETCH_LIMIT)


def fixability_score_strategy_per_project(
    projects: Sequence[Project],
    max_candidates: int,
) -> list[ScoredCandidate]:
    """Like fixability_score_strategy, but scores each project independently so
    no project can crowd out the others' share of max_candidates."""
    fetch_limit = min(
        NIGHT_SHIFT_ISSUE_FETCH_LIMIT, max_candidates * NIGHT_SHIFT_PER_PROJECT_FETCH_MULTIPLIER
    )
    selected: list[ScoredCandidate] = []
    for project in projects:
        selected.extend(_fetch_and_score([project], max_candidates, fetch_limit))
    return selected


def _fetch_and_score(
    projects: Sequence[Project],
    max_candidates: int,
    fetch_limit: int,
) -> list[ScoredCandidate]:
    """
    Fetch top recommended unresolved issues that haven't been triaged by Seer yet.
    Issues with a fixability score above the threshold are taken first (sorted by
    fixability), then backfilled with unscored issues in their original recommended
    sort order.

    Recently-skipped issues can't be excluded at query time, so a single page of
    results can be whittled well below fetch_limit. We page through additional
    results (up to NIGHT_SHIFT_MAX_SEARCH_PAGES) until we've gathered a full
    page's worth of non-skipped candidates or run out of issues.
    """
    # Default types + LowValueSpan
    type_ids = sorted(group_types_from([]) | {LowValueSpanConfigurationType.type_id})
    search_filters = [
        SearchFilter(SearchKey("status"), "=", SearchValue([GroupStatus.UNRESOLVED])),
        SearchFilter(SearchKey("issue.seer_last_run"), "=", SearchValue("")),
        SearchFilter(SearchKey("issue.type"), "=", SearchValue(type_ids)),
    ]

    scored: list[ScoredCandidate] = []
    unscored: list[ScoredCandidate] = []
    kept = 0
    cursor: Cursor | None = None

    for page in range(NIGHT_SHIFT_MAX_SEARCH_PAGES):
        result = search.backend.query(
            projects=projects,
            sort_by="recommended",
            limit=fetch_limit,
            cursor=cursor,
            search_filters=search_filters,
            referrer=Referrer.SEER_NIGHT_SHIFT_FIXABILITY_SCORE_STRATEGY.value,
        )

        skipped_ids = recently_skipped(g.id for g in result.results)
        kept += len(result.results) - len(skipped_ids)

        logger.info(
            "night_shift.search_results",
            extra={
                "projects": [project.id for project in projects],
                "num_projects": len(projects),
                "page": page,
                "num_results": len(result.results),
                "num_skip_filtered": len(skipped_ids),
                "num_kept_after_skip_filter": len(result.results) - len(skipped_ids),
            },
        )

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

        # We're aiming to collect a full page of non-skipped results.
        # If that happens in a single query that's ideal - if not we
        # continue till we've looked at NIGHT_SHIFT_MAX_SEARCH_PAGES.
        if kept >= fetch_limit or not result.next:
            break

        cursor = result.next

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
