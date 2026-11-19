"""Advance and reconcile an organization's persisted evaluator checkpoint."""

from collections.abc import Collection, Sequence
from datetime import datetime
from typing import Any

from sentry.anomaly_detection.checkpoint.codec import _restore, _snapshot
from sentry.anomaly_detection.checkpoint.retention import _evict_stale_series, _reconcile_projects
from sentry.anomaly_detection.contracts import ChangeEvent, SeriesRow
from sentry.anomaly_detection.correlation.correlator import FootprintSource
from sentry.anomaly_detection.evaluation.baseline import MINUTE
from sentry.anomaly_detection.evaluation.organization import AnomalyDecision, OrgEvaluator


def advance_org(
    *,
    rows: Sequence[SeriesRow],
    hourly_rows: Sequence[SeriesRow],
    start: datetime,
    end: datetime,
    footprints: FootprintSource,
    projects: Collection[int],
    new_issues: Sequence[ChangeEvent] = (),
    checkpoint: dict[str, Any] | None = None,
) -> tuple[Sequence[AnomalyDecision], dict[str, Any]]:
    """Advance one organization; pass the full seasonal support in hourly_rows each time.

    Minute support is carried across calls; hourly aggregates are loaded by the
    caller each time. `projects` are the IDs of projects with an enabled detector;
    pass a footprint source scoped to them. Groups of projects that left scope close.
    """
    evaluator = (
        OrgEvaluator(footprints, projects=projects)
        if checkpoint is None
        else _restore(footprints, checkpoint, projects=projects)
    )
    if start >= end:
        return [], _snapshot(evaluator, end)
    scope_closes = _reconcile_projects(evaluator, set(projects), start) if checkpoint else []
    decisions = evaluator.advance(
        rows=rows,
        hourly_rows=hourly_rows,
        start=start,
        end=end,
        new_issues=new_issues,
    )
    cursor = evaluator.next_minute or end
    stale_closes = _evict_stale_series(evaluator, cursor, max(start, cursor - MINUTE))
    return [*scope_closes, *decisions, *stale_closes], _snapshot(evaluator, end)
