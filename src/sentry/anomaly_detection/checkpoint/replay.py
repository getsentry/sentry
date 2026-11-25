"""Advance and reconcile an organization's persisted evaluator checkpoint."""

from collections.abc import Collection, Mapping, Sequence
from datetime import datetime

from sentry.anomaly_detection.checkpoint.retention import (
    bound_context,
    evict_stale_series,
    history_floor,
)
from sentry.anomaly_detection.contracts import ChangeEvent, SeriesKey, SeriesRow
from sentry.anomaly_detection.correlation.correlator import FootprintSource
from sentry.anomaly_detection.evaluation.baseline import MINUTE
from sentry.anomaly_detection.evaluation.organization import (
    AnomalyDecision,
    Checkpoint,
    EvaluatorConfig,
    OrgEvaluator,
)
from sentry.anomaly_detection.inputs.shapes import SeriesShape


def advance_org(
    *,
    rows: Sequence[SeriesRow],
    shapes: Mapping[SeriesKey, SeriesShape],
    start: datetime,
    end: datetime,
    footprints: FootprintSource,
    projects: Collection[int],
    new_issues: Sequence[ChangeEvent] = (),
    checkpoint: Checkpoint | None = None,
    config: EvaluatorConfig | None = None,
) -> tuple[Sequence[AnomalyDecision], Checkpoint]:
    """Advance one organization; pass the day's shapes (see inputs.shapes) each time.

    Minute support and the shapes of open slice anchors are carried across calls.
    `projects` are the IDs of projects with an enabled detector; pass a footprint source
    scoped to them. Groups of projects that left scope close.
    """
    evaluator = OrgEvaluator(footprints, projects=projects, config=config, checkpoint=checkpoint)
    if start >= end:
        return [], snapshot(evaluator, end)
    scope_closes = evaluator.drop_projects(set(projects), start) if checkpoint else []
    decisions = evaluator.advance(
        rows=rows,
        shapes=shapes,
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
    return Checkpoint(series, evaluator.shape_support(), evaluator.state)
