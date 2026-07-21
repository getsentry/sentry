from __future__ import annotations

import logging
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import timedelta

import sentry_sdk
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from snuba_sdk import Request
from snuba_sdk.column import Column
from snuba_sdk.conditions import Condition, Op
from snuba_sdk.entity import Entity
from snuba_sdk.function import Function
from snuba_sdk.query import Limit, Query

from sentry import features, options, search
from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.issues.search import group_types_from
from sentry.models.group import Group, GroupStatus
from sentry.models.project import Project
from sentry.processing_errors.grouptype import LowValueSpanConfigurationType
from sentry.seer.autofix.constants import FixabilityScoreThresholds
from sentry.seer.autofix.utils import is_issue_category_eligible
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.tasks.seer.night_shift.models import TriageAction, TriageResult
from sentry.tasks.seer.night_shift.skip_cache import recently_skipped
from sentry.types.group import PriorityLevel
from sentry.utils.cursors import Cursor
from sentry.utils.snuba import raw_snql_query

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
    if features.has(
        "organizations:agentic-triage-sort", projects[0].organization
    ):  # Assume all projects are in the same org
        return _fetch_and_score_agentic(projects, max_candidates, NIGHT_SHIFT_ISSUE_FETCH_LIMIT)
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
        if features.has("organizations:agentic-triage-sort", project.organization):
            selected.extend(_fetch_and_score_agentic([project], max_candidates, fetch_limit))
        else:
            selected.extend(_fetch_and_score([project], max_candidates, fetch_limit))
    return selected


def _agentic_triage_snuba_factors(
    group_ids: Sequence[int],
    project_ids: Sequence[int],
    organization_id: int,
) -> dict[int, dict[str, float]]:
    """Single Snuba query returning 4 raw factor values per group over the lookback window."""
    lookback = options.get("snuba.search.agentic-triage.lookback-seconds")
    now = timezone.now()
    start = now - timedelta(seconds=lookback)

    select: list[Column | Function] = [
        Column("group_id"),
        Function("max", [Column("timestamp")], alias="max_timestamp"),
        # level is a string in Snuba — map to integer so max() is numeric.
        Function(
            "max",
            [
                Function(
                    "multiIf",
                    [
                        Function("equals", [Column("level"), "fatal"]),
                        4,
                        Function("equals", [Column("level"), "error"]),
                        3,
                        Function("equals", [Column("level"), "warning"]),
                        2,
                        Function("equals", [Column("level"), "info"]),
                        1,
                        0,
                    ],
                )
            ],
            alias="max_level",
        ),
        Function("count", [], alias="event_count"),
    ]
    # uniq(user) is expensive — only include if weight is non-zero.
    if options.get("snuba.search.agentic-triage.user-impact-weight"):
        select.append(Function("uniq", [Column("tags[sentry:user]")], alias="unique_users"))

    query = Query(
        match=Entity("events"),
        select=select,
        where=[
            Condition(Column("group_id"), Op.IN, list(group_ids)),
            Condition(Column("project_id"), Op.IN, list(project_ids)),
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column("timestamp"), Op.LT, now),
        ],
        groupby=[Column("group_id")],
        limit=Limit(len(group_ids)),
    )
    request = Request(
        dataset=Dataset.Events.value,
        app_id="night_shift",
        query=query,
        tenant_ids={"organization_id": organization_id},
    )
    rows = raw_snql_query(
        request, referrer=Referrer.SEER_NIGHT_SHIFT_FIXABILITY_SCORE_STRATEGY.value
    )["data"]
    result: dict[int, dict[str, float]] = {}
    for row in rows:
        factors = dict(row)
        # Convert timestamp string to epoch float for scoring.
        ts = factors.get("max_timestamp")
        if isinstance(ts, str):
            dt = parse_datetime(ts)
            factors["max_timestamp"] = dt.timestamp() if dt else 0.0
        result[factors.pop("group_id")] = factors
    return result


AGENTIC_TRIAGE_FACTORS = [
    ("max_timestamp", "snuba.search.agentic-triage.recency-weight"),
    ("max_level", "snuba.search.agentic-triage.severity-weight"),
    ("unique_users", "snuba.search.agentic-triage.user-impact-weight"),
    ("event_count", "snuba.search.agentic-triage.event-volume-weight"),
]


def _agentic_triage_score(
    group_ids: Sequence[int],
    snuba_factors: dict[int, dict[str, float]],
) -> dict[int, float]:
    """Min-max normalize Snuba factors and return {group_id: weighted_score}."""
    active = [(k, options.get(opt)) for k, opt in AGENTIC_TRIAGE_FACTORS if options.get(opt)]
    if not active or not group_ids:
        return {gid: 0.0 for gid in group_ids}

    # Build raw arrays in group_ids order.
    raw = {k: [float(snuba_factors.get(gid, {}).get(k, 0)) for gid in group_ids] for k, _ in active}

    # Min-max normalize each factor.
    normed: dict[str, list[float]] = {}
    for k, vals in raw.items():
        mn, mx = min(vals), max(vals)
        rng = mx - mn
        normed[k] = [(v - mn) / rng if rng else 0.0 for v in vals]

    return {gid: sum(w * normed[k][i] for k, w in active) for i, gid in enumerate(group_ids)}


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

        if kept >= fetch_limit or not result.next:
            break

        cursor = result.next

    scored.sort(key=lambda c: c.fixability or 0.0, reverse=True)
    selected = (scored + unscored)[:max_candidates]

    for c in selected:
        if c.fixability is not None:
            sentry_sdk.metrics.distribution("night_shift.fixability_score", c.fixability)

    return selected


def _fetch_and_score_agentic(
    projects: Sequence[Project],
    max_candidates: int,
    fetch_limit: int,
) -> list[ScoredCandidate]:
    """Agentic triage path: Postgres for eligible groups, Snuba for scoring factors,
    min-max normalize, then re-rank by fixability."""

    # Step 1: Get eligible group IDs from Postgres with pagination.
    # Mirrors the search.backend.query filters: unresolved, un-triaged, eligible types.
    type_ids = sorted(group_types_from([]) | {LowValueSpanConfigurationType.type_id})
    # Exclude groups Seer ran on within the last 30 days (matching the
    # RecentDateCondition used by the recommended path's search filter).
    seer_recency_cutoff = timezone.now() - timedelta(days=30)
    base_qs = (
        Group.objects.filter(
            project__in=projects,
            status=GroupStatus.UNRESOLVED,
            type__in=type_ids,
        )
        .exclude(seer_explorer_autofix_last_triggered__gte=seer_recency_cutoff)
        .order_by("-last_seen")
    )

    # Page through to collect enough non-skipped candidates, same pattern as the
    # recommended path. Skip filtering happens in Python so one page may not yield
    # enough usable candidates.
    candidates: list[Group] = []
    offset = 0
    for _page in range(NIGHT_SHIFT_MAX_SEARCH_PAGES):
        batch = list(base_qs[offset : offset + fetch_limit])
        if not batch:
            break

        skipped_ids = recently_skipped(g.id for g in batch)
        for group in batch:
            if group.id in skipped_ids:
                continue
            if not is_issue_category_eligible(group):
                continue
            candidates.append(group)

        offset += fetch_limit
        if len(candidates) >= fetch_limit:
            break

    if not candidates:
        return []

    # Step 2: One Snuba query for all 4 scoring factors on these groups.
    group_ids = [g.id for g in candidates]
    project_ids = [p.id for p in projects]
    factors = _agentic_triage_snuba_factors(group_ids, project_ids, projects[0].organization_id)

    # Step 3: Only score groups that got Snuba results. Non-error types
    # (issue-platform) won't have rows in the events entity — append them
    # after scored groups so they don't distort min-max normalization.
    with_data = [g for g in candidates if g.id in factors]
    without_data = [g for g in candidates if g.id not in factors]
    scores = _agentic_triage_score([g.id for g in with_data], factors)
    with_data.sort(key=lambda g: scores.get(g.id, 0.0), reverse=True)

    # Step 4: Take the top 10 issues each from the scored and unscored groups and re-rank by fixability.
    eligible = [
        g
        for g in with_data[:10] + without_data[:10]
        if g.seer_fixability_score is None or g.seer_fixability_score >= FIXABILITY_SCORE_THRESHOLD
    ]
    eligible.sort(
        key=lambda g: (g.seer_fixability_score is not None, g.seer_fixability_score or 0.0),
        reverse=True,
    )

    return [
        ScoredCandidate(group=g, fixability=g.seer_fixability_score, times_seen=g.times_seen)
        for g in eligible[:max_candidates]
    ]


def priority_label(priority: int | None) -> str | None:
    if priority is None:
        return None
    try:
        return PriorityLevel(priority).name.lower()
    except ValueError:
        return None
