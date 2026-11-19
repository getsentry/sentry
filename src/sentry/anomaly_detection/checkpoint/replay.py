"""Advance an organization evaluator from its persisted checkpoint."""

from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Any

from sentry.anomaly_detection.checkpoint.codec import _restore, _snapshot
from sentry.anomaly_detection.checkpoint.retention import _evict_stale_series, _reconcile_projects
from sentry.anomaly_detection.contracts import ChangeEvent
from sentry.anomaly_detection.correlation.correlator import FootprintSource
from sentry.anomaly_detection.detector_handler import AnomalyDetectionDetectorHandler
from sentry.anomaly_detection.evaluation.baseline import MINUTE
from sentry.anomaly_detection.evaluation.organization import AnomalyDecision, OrgEvaluator
from sentry.anomaly_detection.evaluation.series import SeriesRow


def advance_org(
    *,
    rows: Sequence[SeriesRow],
    hourly_rows: Sequence[SeriesRow],
    start: datetime,
    end: datetime,
    footprints: FootprintSource,
    handlers: Mapping[str, AnomalyDetectionDetectorHandler],
    new_issues: Sequence[ChangeEvent] = (),
    checkpoint: dict[str, Any] | None = None,
) -> tuple[Sequence[AnomalyDecision], dict[str, Any]]:
    """Advance one organization; pass the full seasonal support in hourly_rows each time.

    Minute support is carried across calls; hourly aggregates are loaded by the
    caller each time. The checkpoint does not acknowledge any emitted decision.
    The handler map defines the enabled projects. Pass a footprint source scoped to
    these projects. Invalidation retires intersecting groups, closing previously
    qualified opens only if their original owner remains enabled.
    """
    evaluator = (
        OrgEvaluator(footprints, handlers=handlers)
        if checkpoint is None
        else _restore(footprints, checkpoint, handlers=handlers)
    )
    if start >= end:
        return [], _snapshot(evaluator, end)
    scope_closes = (
        _reconcile_projects(evaluator, handlers.keys(), start) if checkpoint is not None else []
    )
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
