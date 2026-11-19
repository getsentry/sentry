"""Advance and reconcile an organization's persisted evaluator checkpoint."""

from collections.abc import Collection, Sequence
from datetime import datetime

from sentry.anomaly_detection.checkpoint.retention import (
    bound_context,
    evict_stale_series,
    history_floor,
)
from sentry.anomaly_detection.contracts import ChangeEvent, SeriesRow
from sentry.anomaly_detection.correlation.correlator import FootprintSource
from sentry.anomaly_detection.evaluation.baseline import MINUTE
from sentry.anomaly_detection.evaluation.organization import (
    AnomalyDecision,
    Checkpoint,
    EvaluatorConfig,
    OrgEvaluator,
)


def advance_org(
    *,
    rows: Sequence[SeriesRow],
    hourly_rows: Sequence[SeriesRow],
    start: datetime,
    end: datetime,
    footprints: FootprintSource,
    projects: Collection[int],
    new_issues: Sequence[ChangeEvent] = (),
    checkpoint: Checkpoint | None = None,
    config: EvaluatorConfig | None = None,
) -> tuple[Sequence[AnomalyDecision], Checkpoint]:
    """Advance one organization; pass the full seasonal support in hourly_rows each time.

    Minute support is carried across calls; hourly aggregates are loaded by the
    caller each time. `projects` are the IDs of projects with an enabled detector;
    pass a footprint source scoped to them. Groups of projects that left scope close.
    """
    evaluator = OrgEvaluator(footprints, projects=projects, config=config, checkpoint=checkpoint)
    if start >= end:
        return [], snapshot(evaluator, end)
    scope_closes = evaluator.drop_projects(set(projects), start) if checkpoint else []
    decisions = evaluator.advance(
        rows=rows,
        hourly_rows=hourly_rows,
        start=start,
        end=end,
        new_issues=new_issues,
    )
    cursor = evaluator.next_minute or end
    stale_closes = evict_stale_series(evaluator, cursor, max(start, cursor - MINUTE))
    return [*scope_closes, *decisions, *stale_closes], snapshot(evaluator, end)


def snapshot(evaluator: OrgEvaluator, end: datetime) -> Checkpoint:
    """Bound the evaluator's state and capture what a later run needs to resume.

    Retention applies to the live evaluator as well; measurements are copied.
    """
    cursor = evaluator.next_minute or end
    bound_context(evaluator, cursor)
    since = history_floor(evaluator, cursor)
    series = {
        key: {minute: value for minute, value in points.items() if since <= minute < cursor}
        for key, points in evaluator.series.items()
    }
    hourly = evaluator.hourly_support(*evaluator.baseline.checkpoint_hourly_bounds(cursor))
    return Checkpoint(series, hourly, evaluator.state)
