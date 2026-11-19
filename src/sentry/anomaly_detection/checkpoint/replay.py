"""Advance and reconcile an organization's persisted evaluator checkpoint."""

from collections.abc import Mapping, Sequence
from datetime import UTC, datetime
from typing import Any

from django.db import router, transaction
from django.utils import timezone

from sentry.anomaly_detection.checkpoint.codec import _restore, _snapshot
from sentry.anomaly_detection.checkpoint.retention import _evict_stale_series, _reconcile_projects
from sentry.anomaly_detection.contracts import ChangeEvent
from sentry.anomaly_detection.correlation.correlator import FootprintSource
from sentry.anomaly_detection.delivery.pending_transitions import DeliveryState
from sentry.anomaly_detection.detector_handler import (
    AnomalyDetectionDetectorHandler,
    enabled_anomaly_detectors,
)
from sentry.anomaly_detection.evaluation.baseline import MINUTE
from sentry.anomaly_detection.evaluation.organization import AnomalyDecision, OrgEvaluator
from sentry.anomaly_detection.evaluation.series import SeriesRow
from sentry.models.anomaly_detection_state import AnomalyDetectionState


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


class _CheckpointOnlyFootprints:
    def footprint(self, event: ChangeEvent, observation_end: datetime, /) -> None:
        raise AssertionError("Checkpoint cleanup does not collect footprints")


def remove_project_state(*, organization_id: int, project_id: int) -> None:
    """Scrub durable state during project deletion, even if evaluation is disabled."""
    from sentry.anomaly_detection.delivery.outbox import next_state_revision

    db = router.db_for_write(AnomalyDetectionState)
    state_rows = AnomalyDetectionState.objects.using(db).filter(organization_id=organization_id)
    with transaction.atomic(using=db):
        state = state_rows.select_for_update().get_or_none()
        if state is None:
            return

        # The project row still exists when the deletion task calls us.
        projects = {
            str(pid)
            for pid in enabled_anomaly_detectors()
            .using(db)
            .filter(project__organization_id=organization_id)
            .exclude(project_id=project_id)
            .order_by()
            .values_list("project_id", flat=True)
            .distinct()
        }
        if not projects:
            state_rows.delete()
            return

        checkpoint, raw_delivery = state.checkpoint, state.delivery
        boundary = (state.next_minute or timezone.now()).astimezone(UTC).replace(tzinfo=None)
        closes = []
        if checkpoint is not None:
            evaluator = _restore(_CheckpointOnlyFootprints(), checkpoint, handlers={})
            closes = _reconcile_projects(evaluator, projects, boundary)
            checkpoint = _snapshot(evaluator, boundary)

        if raw_delivery is not None:
            delivery = DeliveryState.from_json(raw_delivery)
            removed_keys = {
                key for key, pin in delivery.pins.items() if pin.project_id == project_id
            }
            for key in removed_keys:
                del delivery.pins[key]
            pending = [
                item
                for item in delivery.pending
                if item.logical_key not in removed_keys and item.transition.project_id != project_id
            ]
            if closes:
                # Stage only closes for existing activations. Do not allow normal
                # backlog pruning to drop unrelated pending work during deletion.
                delivery.pending = []
                delivery.stage(
                    closes,
                    {},
                    start=boundary,
                    end=boundary + MINUTE,
                    retained_keys=set(delivery.pins),
                )
                pending.extend(delivery.pending)
            delivery.pending = pending
            raw_delivery = delivery.to_json()

        # Even a blank checkpoint can have a worker evaluating against the old scope.
        state_rows.update(
            checkpoint=checkpoint,
            delivery=raw_delivery,
            date_updated=next_state_revision(state.date_updated),
        )
