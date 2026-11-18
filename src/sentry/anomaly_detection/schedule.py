from __future__ import annotations

import logging
import zlib
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

import orjson
from django.db import router, transaction
from django.utils import timezone
from taskbroker_client.retry import Retry

from sentry import features
from sentry.anomaly_detection.checkpoint import advance_org, retained_group_keys
from sentry.anomaly_detection.collection import Row, collect
from sentry.anomaly_detection.enrichment import (
    TraceLookup,
    collect_new_failure_modes,
    new_failure_thresholds,
)
from sentry.anomaly_detection.grouptype import (
    AnomalyDetection,
    AnomalyDetectionDetectorHandler,
    publish_anomaly_transition,
)
from sentry.anomaly_detection.state import DeliveryState
from sentry.constants import ObjectStatus
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.issues.ingest import hash_fingerprint
from sentry.issues.status_change_consumer import get_group_from_fingerprint
from sentry.locks import locks
from sentry.models.anomaly_detection_state import AnomalyDetectionState
from sentry.models.group import GroupStatus
from sentry.models.grouphash import GroupHash
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.project import Project
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import workflow_engine_tasks
from sentry.types.cell import get_local_cell
from sentry.utils import metrics
from sentry.utils.cache import cache
from sentry.utils.locking import UnableToAcquireLock
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.types import DetectorType

logger = logging.getLogger(__name__)

FEATURE = "organizations:anomaly-detector"
_MINUTE = timedelta(minutes=1)
_INGEST_DELAY = timedelta(minutes=2)
_MINUTE_WARMUP = timedelta(hours=5)
_HOURLY_LOOKBACK = timedelta(days=16)
_MAX_CATCHUP = timedelta(minutes=15)
_MAX_ORGS_PER_TICK = 20
_MAX_PROJECTS = 10
_MAX_DELIVERIES = 4
_MAX_CHECKPOINT_BYTES = 8 * 1024 * 1024
_MAX_CACHE_BYTES = 900_000
_INGEST_RETRY_DELAY = timedelta(minutes=5)


def _enabled_detectors() -> BaseQuerySet[Detector]:
    return Detector.objects.filter(
        type=DetectorType.ANOMALY_DETECTION.value,
        status=ObjectStatus.ACTIVE,
        enabled=True,
        project__status=ObjectStatus.ACTIVE,
        project__organization__status=OrganizationStatus.ACTIVE,
    )


def _eligible(organization: Organization) -> bool:
    # Unreleased Issue Platform types have a separate consumer-side ingest gate.
    return features.has(FEATURE, organization) and AnomalyDetection.allow_ingest(organization)


def _closed_end() -> datetime:
    return (timezone.now() - _INGEST_DELAY).replace(second=0, microsecond=0)


@instrumented_task(
    name="sentry.anomaly_detection.schedule.schedule_anomaly_detectors",
    namespace=workflow_engine_tasks,
    processing_deadline_duration=50,
    silo_mode=SiloMode.CELL,
)
def schedule_anomaly_detectors() -> None:
    cell = get_local_cell().name
    cursor_key = f"anomaly-detection:fanout:v1:{cell}"
    after = cache.get(cursor_key, 0)
    candidates = (
        _enabled_detectors()
        .order_by("project__organization_id")
        .values_list("project__organization_id", flat=True)
        .distinct()
    )
    organization_ids = list(
        candidates.filter(project__organization_id__gt=after)[:_MAX_ORGS_PER_TICK]
    )
    if len(organization_ids) < _MAX_ORGS_PER_TICK and after:
        spare = _MAX_ORGS_PER_TICK - len(organization_ids)
        organization_ids.extend(candidates.filter(project__organization_id__lte=after)[:spare])

    organizations = Organization.objects.in_bulk(organization_ids)
    end = _closed_end().isoformat()
    for organization_id in organization_ids:
        organization = organizations.get(organization_id)
        if organization is not None and _eligible(organization):
            run_anomaly_detection.delay(organization_id, end)
    # Losing this cursor only reorders the next pass; the worker checkpoint is durable.
    cache.set(cursor_key, organization_ids[-1] if organization_ids else 0, 3600)


def _hourly_rows(
    organization: Organization, projects: Sequence[Project], end: datetime
) -> list[Row]:
    end = end.replace(minute=0)
    scope = ":".join(str(project.id) for project in projects)
    key = f"anomaly-detection:hourly:v1:{get_local_cell().name}:{organization.id}:{scope}:{end.isoformat()}"
    payload = cache.get(key)
    if payload is not None:
        return [
            (datetime.fromisoformat(ts), signal, metric, project, env, dim, value)
            for ts, signal, metric, project, env, dim, value in orjson.loads(
                zlib.decompress(payload)
            )
        ]
    rows = collect(organization, projects, end - _HOURLY_LOOKBACK, end, "1h")
    payload = zlib.compress(orjson.dumps(rows))
    if len(payload) <= _MAX_CACHE_BYTES:
        cache.set(key, payload, 3600)
    else:
        metrics.incr("anomaly_detection.hourly_snapshot_too_large")
    return rows


def _deliver_one(state_id: int, organization_id: int, db: str) -> bool:
    """Advance at most one FIFO entry. False means there is no deliverable work.

    A short row lock fences retries even if the org lease expires. Kafka and Postgres
    cannot share a commit: a crash in between replays the same project, fingerprint,
    and deterministic occurrence/status ID; never acknowledge just a handler return.
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
            return False
        delivery = DeliveryState.from_json(raw_delivery)
        if not delivery.pending:
            return False
        pending = delivery.pending[0]
        transition = pending.transition
        detector = _enabled_detectors().get_or_none(
            id=pending.detector_id,
            project_id=transition.project_id,
            project__organization_id=organization_id,
        )
        if detector is None:
            # Disabling/removing a detector cancels only its affected publications.
            # Never reroute that lifecycle, even if the project has a new detector.
            logger.warning(
                "anomaly_detection.delivery_detector_inactive",
                extra={"organization_id": organization_id, "detector_id": pending.detector_id},
            )
            delivery.retire(pending.logical_key)
            state_rows.update(delivery=delivery.to_json(), date_updated=timezone.now())
            return True
        if pending.confirm_ingested:
            fingerprint = hash_fingerprint(
                AnomalyDetectionDetectorHandler(detector).get_issue_fingerprint(
                    transition.group_key
                )
            )
            group = get_group_from_fingerprint(transition.project_id, fingerprint)
            # The consumer moves status changes to the end of a batch. Observe
            # opens and closes in the issue DB before subsequent work.
            # A manually resolved issue already has the intended close state.
            ingested = group is not None and (
                group.status == GroupStatus.RESOLVED
                if transition.is_resolved
                else group.last_seen >= transition.timestamp_utc
            )
            if not ingested:
                if (
                    group is None
                    and GroupHash.objects.filter(
                        project_id=transition.project_id,
                        hash__in=fingerprint,
                        group_tombstone_id__isnull=False,
                    ).exists()
                ):
                    metrics.incr("anomaly_detection.delivery_tombstoned")
                    delivery.retire(pending.logical_key)
                    state_rows.update(delivery=delivery.to_json(), date_updated=timezone.now())
                    return True
                if transition.is_resolved and group is None:
                    # FIFO already observed this lifecycle's open. Its issue
                    # was removed since then; do not send an orphan close.
                    logger.warning(
                        "anomaly_detection.delivery_issue_removed",
                        extra={"organization_id": organization_id, "detector_id": detector.id},
                    )
                    delivery.retire(pending.logical_key)
                    state_rows.update(delivery=delivery.to_json(), date_updated=timezone.now())
                    return True
                now = timezone.now()
                if (
                    pending.broker_acked_at is None
                    or now - pending.broker_acked_at >= _INGEST_RETRY_DELAY
                ):
                    publish_anomaly_transition(detector, transition)
                    pending.broker_acked_at = now
                    state_rows.update(delivery=delivery.to_json(), date_updated=timezone.now())
                metrics.incr("anomaly_detection.delivery_waiting_for_ingest")
                return False
        else:
            publish_anomaly_transition(detector, transition)
        delivery.pending.pop(0)
        state_rows.update(delivery=delivery.to_json(), date_updated=timezone.now())
        return True


def _drain(state_id: int, organization_id: int, db: str) -> None:
    for _ in range(_MAX_DELIVERIES):
        if not _deliver_one(state_id, organization_id, db):
            break


def _run_organization(organization_id: int, end: datetime) -> None:
    organization = Organization.objects.get_or_none(
        id=organization_id, status=OrganizationStatus.ACTIVE
    )
    if organization is None or not _eligible(organization):
        return

    detector_rows = list(
        _enabled_detectors()
        .filter(project__organization_id=organization_id)
        .order_by("project_id", "id")
        .distinct("project_id")
        .select_related("project")[: _MAX_PROJECTS + 1]
    )
    if not detector_rows:
        return
    if len(detector_rows) > _MAX_PROJECTS:
        raise RuntimeError("Anomaly detection organization exceeds the project limit")
    projects = [detector.linked_project for detector in detector_rows]
    detector_ids = {detector.linked_project.id: detector.id for detector in detector_rows}

    db = router.db_for_write(AnomalyDetectionState)
    state, _ = AnomalyDetectionState.objects.using(db).get_or_create(
        organization_id=organization_id
    )
    delivery = DeliveryState.from_json(state.delivery)
    if delivery.pending:
        _drain(state.id, organization_id, db)
        state = AnomalyDetectionState.objects.using(db).get(id=state.id)
        delivery = DeliveryState.from_json(state.delivery)
        if delivery.pending:
            # Backpressure: do not expand the durable queue while earlier work is stuck.
            return

    if state.next_minute is None:
        # Collect warmup data, but only publish the active state at the boundary.
        publish_from = end - _MINUTE
        fetch_start = publish_from - _MINUTE_WARMUP
    else:
        fetch_start = publish_from = state.next_minute.astimezone(UTC).replace(tzinfo=None)
        end = min(end, publish_from + _MAX_CATCHUP)
        if publish_from >= end:
            return

    rows = collect(organization, projects, fetch_start, end, "1m")
    hourly_rows = _hourly_rows(organization, projects, end)
    new_issues = collect_new_failure_modes(
        organization, projects, new_failure_thresholds(hourly_rows), fetch_start, end
    )
    decisions, checkpoint = advance_org(
        rows=rows,
        hourly_rows=hourly_rows,
        start=publish_from,
        end=end,
        footprints=TraceLookup(organization, projects),
        new_issues=new_issues,
        checkpoint=state.checkpoint,
        current_projects={str(p.id) for p in projects},
    )
    size = len(orjson.dumps(checkpoint))
    metrics.distribution("anomaly_detection.checkpoint_bytes", size)
    if size > _MAX_CHECKPOINT_BYTES:
        raise RuntimeError("Anomaly evaluation checkpoint exceeded its capacity")
    delivery.stage(
        decisions,
        detector_ids,
        start=publish_from,
        end=end,
        retained_keys=retained_group_keys(checkpoint),
    )
    # Commit the model and its pending output together, before any Kafka side effect.
    # A slow duplicate worker cannot overwrite a newer checkpoint.
    updated = (
        AnomalyDetectionState.objects.using(db)
        .filter(
            id=state.id,
            next_minute=state.next_minute,
        )
        .update(
            next_minute=end.replace(tzinfo=UTC),
            checkpoint=checkpoint,
            delivery=delivery.to_json(),
            date_updated=timezone.now(),
        )
    )
    if updated and delivery.pending:
        _drain(state.id, organization_id, db)


@instrumented_task(
    name="sentry.anomaly_detection.schedule.run_anomaly_detection",
    namespace=workflow_engine_tasks,
    processing_deadline_duration=240,
    retry=Retry(times=2, delay=30),
    silo_mode=SiloMode.CELL,
)
def run_anomaly_detection(organization_id: int, end: str) -> None:
    target = datetime.fromisoformat(end)
    if target.utcoffset() != timedelta(0) or target.second or target.microsecond:
        raise ValueError("Anomaly evaluation requires a UTC minute boundary")
    target = min(target, _closed_end()).replace(tzinfo=None)
    lease = locks.get(
        f"anomaly-detection:org:{get_local_cell().name}:{organization_id}",
        duration=300,
        name="anomaly_detection_org",
    )
    try:
        acquired = lease.acquire()
    except UnableToAcquireLock:
        if not lease.locked():
            raise
        metrics.incr("anomaly_detection.worker_already_running")
        return
    with acquired:
        _run_organization(organization_id, target)
