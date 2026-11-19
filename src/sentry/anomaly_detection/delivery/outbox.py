"""Publish staged transitions and confirm ingestion before acknowledging them."""

from __future__ import annotations

import logging
from collections.abc import Sequence
from datetime import timedelta

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from sentry.anomaly_detection.delivery.pending_transitions import DeliveryState
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
_INGEST_RETRY_DELAY = timedelta(minutes=5)


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
            raw_delivery = (
                state_rows.select_for_update(skip_locked=True)
                .values_list("delivery", flat=True)
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
        if detector is None:
            # Disabling/removing a detector cancels only its affected publications.
            # Never reroute that lifecycle, even if the project has a new detector.
            logger.warning(
                "anomaly_detection.delivery_detector_inactive",
                extra={"organization_id": organization_id, "detector_id": pending.detector_id},
            )
            delivery.retire_owner(pending.logical_key)
        else:
            handler = get_anomaly_handler(detector)
            fingerprint = hash_fingerprint(handler.get_issue_fingerprint(transition.group_key))
            group = get_group_from_fingerprint(transition.project_id, fingerprint)
            # Wait for opens and updates to be visible before sending a close: a
            # broker acknowledgement does not mean the consumer has applied them.
            # A manually resolved issue already has the intended close state.
            if group is not None and (
                group.status == GroupStatus.RESOLVED
                if transition.is_resolved
                else group.last_seen >= transition.timestamp_utc
            ):
                delivery.pending.pop(index)
            elif group is None and _is_tombstoned(transition.project_id, fingerprint):
                metrics.incr("anomaly_detection.delivery_tombstoned")
                delivery.retire_activation(pending)
            elif group is None and not pending.is_open:
                # This activation's open was already observed. Its issue was
                # removed; neither recreate it with an update nor send an orphan close.
                logger.warning(
                    "anomaly_detection.delivery_issue_removed",
                    extra={"organization_id": organization_id, "detector_id": detector.id},
                )
                delivery.retire_activation(pending)
            else:
                now = timezone.now()
                published = (
                    pending.broker_acked_at is None
                    or now - pending.broker_acked_at >= _INGEST_RETRY_DELAY
                )
                if published:
                    publish_anomaly_transition(detector, transition)
                    pending.broker_acked_at = now
                waiting.add(transition.group_key)
                moved = delivery.defer_activation(transition.group_key)
                if published or moved:
                    state_rows.update(delivery=delivery.to_json(), date_updated=now)
                metrics.incr("anomaly_detection.delivery_waiting_for_ingest")
                return published, True
        state_rows.update(delivery=delivery.to_json(), date_updated=timezone.now())
        return True, bool(delivery.pending)


def _is_tombstoned(project_id: int, fingerprint: Sequence[str]) -> bool:
    return GroupHash.objects.filter(
        project_id=project_id, hash__in=fingerprint, group_tombstone_id__isnull=False
    ).exists()


def drain_pending_transitions(state_id: int, organization_id: int, db: str) -> tuple[bool, bool]:
    """Return (pending remains, enqueue continuation) after a bounded drain."""
    waiting: set[str] = set()
    made_progress = False
    for _ in range(_MAX_DELIVERIES):
        result = _deliver_one(state_id, organization_id, db, waiting)
        if result is None:
            return True, False
        progressed, pending_remains = result
        if not pending_remains:
            return False, False
        made_progress |= progressed
    # If the whole pass was waiting on ingestion, let the next cron tick retry.
    return True, made_progress
