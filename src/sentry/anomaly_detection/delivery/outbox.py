"""Publish staged transitions and confirm ingestion before acknowledging them."""

from __future__ import annotations

import logging
from collections.abc import Sequence
from datetime import datetime, timedelta

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from sentry.anomaly_detection.delivery.pending_transitions import DeliveryState, PendingTransition
from sentry.anomaly_detection.delivery.transition import AnomalyTransition
from sentry.anomaly_detection.detector_handler import enabled_anomaly_detectors, get_anomaly_handler
from sentry.issues.ingest import hash_fingerprint
from sentry.issues.status_change_consumer import get_group_from_fingerprint
from sentry.models.anomaly_detection_state import AnomalyDetectionState
from sentry.models.group import GroupStatus
from sentry.models.grouphash import GroupHash
from sentry.utils import metrics
from sentry.workflow_engine.models import DataPacket, Detector
from sentry.workflow_engine.processors.detector import process_detectors

logger = logging.getLogger(__name__)

_MAX_DELIVERIES = 4
_MAX_ATTEMPTS = 4
_INGEST_RETRY_DELAY = timedelta(minutes=5)
_PUBLISH_RETRY_DELAY = timedelta(minutes=1)


def next_state_revision(previous: datetime) -> datetime:
    # The checkpoint and deletion paths use this as a fencing token. Never rewind
    # it, including on a queue-only write from a worker with a slower clock.
    return max(timezone.now(), previous + timedelta(microseconds=1))


def publish_anomaly_transition(detector: Detector, transition: AnomalyTransition) -> None:
    """Publish one outbox transition and wait for broker acknowledgement before returning."""
    packet = DataPacket(source_id=str(detector.id), packet=transition)
    results = process_detectors(packet, [detector])
    if not results or transition.group_key not in results[0][1]:
        raise RuntimeError("Workflow Engine did not produce an anomaly outcome")


def _deliver_one(
    state_id: int, organization_id: int, db: str, waiting: set[str]
) -> tuple[bool, bool] | None:
    """Check one activation's head. Return (made progress, pending remains), if checked.

    The row lock fences retries even if the org lease expires. Kafka and Postgres
    cannot share a commit: a crash in between replays the deterministic transition ID.
    """
    with transaction.atomic(using=db):
        state_rows = AnomalyDetectionState.objects.using(db).filter(
            id=state_id, organization_id=organization_id
        )
        try:
            raw_delivery, revision = (
                state_rows.select_for_update(skip_locked=True)
                .values_list("delivery", "date_updated")
                .get()
            )
        except AnomalyDetectionState.DoesNotExist:
            return None
        delivery = DeliveryState.from_json(raw_delivery)
        index = next(
            (
                i
                for i, item in enumerate(delivery.pending)
                if item.transition.group_key not in waiting
            ),
            None,
        )
        if index is None:
            return None
        pending = delivery.pending[index]
        transition = pending.transition
        detector = (
            enabled_anomaly_detectors()
            .annotate(project_organization_id=F("project__organization_id"))
            .get_or_none(
                id=pending.detector_id,
                project_id=transition.project_id,
                project__organization_id=organization_id,
            )
        )
        progressed = True
        if detector is None:
            # Disabling/removing a detector cancels only its affected publications.
            # Never reroute that lifecycle, even if the project has a new detector.
            logger.warning(
                "anomaly_detection.delivery_detector_inactive",
                extra={"organization_id": organization_id, "detector_id": pending.detector_id},
            )
            delivery.retire_owner(pending.logical_key)
        elif not _acknowledge_or_retire(delivery, index, detector, organization_id):
            retry_at = pending.next_attempt_at
            if retry_at is None and pending.broker_acked_at is not None:
                # Old queue entries carried only a broker acknowledgement timestamp.
                retry_at = pending.broker_acked_at + _INGEST_RETRY_DELAY
            progressed = retry_at is None or timezone.now() >= retry_at
            if progressed and pending.attempts >= _MAX_ATTEMPTS:
                # Ingestion was checked above even after the last attempt. An
                # exhausted update must not strand a close for an ingested issue.
                if pending.is_open:
                    dropped = delivery.retire_activation(pending)
                else:
                    delivery.pending.pop(index)
                    dropped = 1
                metrics.incr(
                    "anomaly_detection.delivery_dropped",
                    amount=dropped,
                    tags={"reason": "attempts_exhausted", "kind": pending.kind},
                    sample_rate=1.0,
                )
            else:
                if progressed:
                    _attempt_publication(pending, detector, organization_id, db)
                waiting.add(transition.group_key)
                if pending.broker_acked_at is not None:
                    metrics.incr("anomaly_detection.delivery_waiting_for_ingest")
                if not delivery.defer_activation(transition.group_key) and not progressed:
                    return False, True

        state_rows.update(delivery=delivery.to_json(), date_updated=next_state_revision(revision))
        return progressed, bool(delivery.pending)


def _attempt_publication(
    pending: PendingTransition, detector: Detector, organization_id: int, db: str
) -> None:
    pending.attempts += 1
    try:
        # Isolate local ingest/Workflow Engine DB errors so a poison transition
        # still records its attempt and doesn't block other activations.
        with transaction.atomic(using=db):
            publish_anomaly_transition(detector, pending.transition)
    except Exception:
        logger.exception(
            "anomaly_detection.delivery_publish_failed",
            extra={"organization_id": organization_id, "detector_id": detector.id},
        )
        pending.next_attempt_at = timezone.now() + _PUBLISH_RETRY_DELAY
    else:
        pending.broker_acked_at = timezone.now()
        pending.next_attempt_at = pending.broker_acked_at + _INGEST_RETRY_DELAY


def _acknowledge_or_retire(
    delivery: DeliveryState, index: int, detector: Detector, organization_id: int
) -> bool:
    """Remove a confirmed transition or retire an activation that cannot be delivered."""
    pending = delivery.pending[index]
    transition = pending.transition
    handler = get_anomaly_handler(detector)
    fingerprint = hash_fingerprint(handler.get_issue_fingerprint(transition.group_key))
    group = get_group_from_fingerprint(transition.project_id, fingerprint)
    if group is not None:
        # Wait for opens and updates to be visible before sending a close. A
        # manually resolved issue already has the intended close state.
        if transition.is_resolved:
            confirmed = group.status == GroupStatus.RESOLVED
        else:
            confirmed = group.last_seen >= transition.timestamp_utc
        if confirmed:
            delivery.pending.pop(index)
        return confirmed

    if _is_tombstoned(transition.project_id, fingerprint):
        metrics.incr("anomaly_detection.delivery_tombstoned")
    elif not pending.is_open:
        # The issue was removed after the open was observed. Don't recreate it
        # with an update or send a close for a missing issue.
        logger.warning(
            "anomaly_detection.delivery_issue_removed",
            extra={"organization_id": organization_id, "detector_id": detector.id},
        )
    else:
        return False

    delivery.retire_activation(pending)
    return True


def _is_tombstoned(project_id: int, fingerprint: Sequence[str]) -> bool:
    return GroupHash.objects.filter(
        project_id=project_id, hash__in=fingerprint, group_tombstone_id__isnull=False
    ).exists()


class PendingTransitionDrain:
    """Share a bounded drain budget across the two sides of an evaluator commit."""

    def __init__(self, state_id: int, organization_id: int, db: str) -> None:
        self.state_id = state_id
        self.organization_id = organization_id
        self.db = db
        self._waiting: set[str] = set()
        self._remaining = _MAX_DELIVERIES
        self._made_progress = False

    def run(self, *, max_checks: int | None = None) -> bool:
        """Drain ready activations; return whether to enqueue a continuation."""
        checks = self._remaining if max_checks is None else min(self._remaining, max_checks)
        for _ in range(checks):
            result = _deliver_one(self.state_id, self.organization_id, self.db, self._waiting)
            if result is None:
                return False
            self._remaining -= 1
            progressed, pending_remains = result
            if not pending_remains:
                return False
            self._made_progress |= progressed
        # If the whole pass was waiting on ingestion, let the next cron tick retry.
        return self._made_progress
