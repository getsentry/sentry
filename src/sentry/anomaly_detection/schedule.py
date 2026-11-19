from __future__ import annotations

import zlib
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

import orjson
from django.db import router
from django.utils import timezone
from taskbroker_client.retry import Retry

from sentry import features
from sentry.anomaly_detection.checkpoint.codec import retained_group_keys
from sentry.anomaly_detection.checkpoint.replay import advance_org
from sentry.anomaly_detection.delivery.outbox import drain_pending_transitions
from sentry.anomaly_detection.delivery.pending_transitions import DeliveryState
from sentry.anomaly_detection.detector_handler import enabled_anomaly_detectors, get_anomaly_handler
from sentry.anomaly_detection.grouptype import AnomalyDetection
from sentry.anomaly_detection.inputs.measurements import Row, collect
from sentry.anomaly_detection.inputs.new_failures import (
    collect_new_failure_modes,
    new_failure_thresholds,
)
from sentry.anomaly_detection.inputs.trace_lookup import TraceLookup
from sentry.locks import locks
from sentry.models.anomaly_detection_state import AnomalyDetectionState
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.project import Project
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import workflow_engine_tasks
from sentry.types.cell import get_local_cell
from sentry.utils import metrics
from sentry.utils.cache import cache
from sentry.utils.locking import UnableToAcquireLock

FEATURE = "organizations:anomaly-detector"
_MINUTE = timedelta(minutes=1)
_INGEST_DELAY = timedelta(minutes=2)
_MINUTE_WARMUP = timedelta(hours=5)
_HOURLY_LOOKBACK = timedelta(days=16)
_MAX_CATCHUP = timedelta(minutes=15)
_MAX_ORGS_PER_TICK = 20
_MAX_PROJECTS = 10
_MAX_CACHE_BYTES = 900_000


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
        enabled_anomaly_detectors()
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


def _run_organization(organization_id: int, target: datetime) -> bool:
    """Make one bounded unit of progress; return whether to enqueue a continuation."""
    organization = Organization.objects.get_or_none(
        id=organization_id, status=OrganizationStatus.ACTIVE
    )
    if organization is None or not _eligible(organization):
        return False

    db = router.db_for_write(AnomalyDetectionState)
    state_rows = AnomalyDetectionState.objects.using(db).filter(organization_id=organization_id)
    delivery_rows = state_rows.values_list("id", "next_minute", "delivery")
    saved_delivery = delivery_rows.get_or_none()
    if saved_delivery is not None:
        state_id, _, delivery_data = saved_delivery
        if DeliveryState.from_json(delivery_data).pending:
            pending_remains, continue_draining = drain_pending_transitions(
                state_id, organization_id, db
            )
            if pending_remains:
                # Commit at most one evaluation batch while there is work to deliver.
                return continue_draining
            saved_delivery = delivery_rows.get_or_none()
            if saved_delivery is None:
                return False
        delivery = DeliveryState.from_json(saved_delivery[2])
    else:
        delivery = DeliveryState()
    if delivery.pending:
        # A worker holding a newer lease may have staged another batch.
        return False

    detector_rows = list(
        enabled_anomaly_detectors()
        .filter(project__organization_id=organization_id)
        .order_by("project_id", "id")
        .distinct("project_id")
        .select_related("project")[: _MAX_PROJECTS + 1]
    )
    if not detector_rows:
        return False
    if len(detector_rows) > _MAX_PROJECTS:
        raise RuntimeError("Anomaly detection organization exceeds the project limit")
    projects = [detector.linked_project for detector in detector_rows]
    detector_ids = {detector.linked_project.id: detector.id for detector in detector_rows}
    handlers = {
        str(detector.linked_project.id): get_anomaly_handler(detector) for detector in detector_rows
    }

    if saved_delivery is None:
        state, created = state_rows.get_or_create(organization_id=organization_id)
        if not created:
            # Another worker acquired the lease and created a checkpoint meanwhile.
            return False
        state_id, next_minute = state.id, state.next_minute
    else:
        state_id, next_minute, _ = saved_delivery

    end = target
    if next_minute is None:
        # Collect warmup data, but only publish the active state at the boundary.
        publish_from = end - _MINUTE
        fetch_start = publish_from - _MINUTE_WARMUP
    else:
        fetch_start = publish_from = next_minute.astimezone(UTC).replace(tzinfo=None)
        end = min(end, publish_from + _MAX_CATCHUP)
        if publish_from >= end:
            return False

    current_row = state_rows.values_list("checkpoint").get_or_none(
        id=state_id, next_minute=next_minute
    )
    if current_row is None:
        return False
    (previous_checkpoint,) = current_row

    rows = collect(organization, projects, fetch_start, end, "1m")
    hourly_rows = _hourly_rows(organization, projects, end)
    new_issues = collect_new_failure_modes(
        organization,
        projects,
        new_failure_thresholds(hourly_rows),
        fetch_start,
        end,
        current_rows=rows,
    )
    decisions, checkpoint = advance_org(
        rows=rows,
        hourly_rows=hourly_rows,
        start=publish_from,
        end=end,
        footprints=TraceLookup(organization, projects),
        new_issues=new_issues,
        checkpoint=previous_checkpoint,
        handlers=handlers,
    )
    metrics.distribution("anomaly_detection.checkpoint_bytes", len(orjson.dumps(checkpoint)))
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
            id=state_id,
            next_minute=next_minute,
        )
        .update(
            next_minute=end.replace(tzinfo=UTC),
            checkpoint=checkpoint,
            delivery=delivery.to_json(),
            date_updated=timezone.now(),
        )
    )
    if not updated:
        return False
    if delivery.pending:
        pending_remains, continue_draining = drain_pending_transitions(
            state_id, organization_id, db
        )
        if pending_remains:
            return continue_draining
    return end < target


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
        should_continue = _run_organization(organization_id, target)
    if should_continue:
        run_anomaly_detection.delay(organization_id, target.replace(tzinfo=UTC).isoformat())
