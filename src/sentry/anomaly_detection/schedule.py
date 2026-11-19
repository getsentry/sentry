from __future__ import annotations

import zlib
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from hashlib import sha256

import orjson
from django.db import router, transaction
from django.utils import timezone
from taskbroker_client.retry import Retry

from sentry import features
from sentry.anomaly_detection.checkpoint.codec import retained_group_keys
from sentry.anomaly_detection.checkpoint.replay import advance_org
from sentry.anomaly_detection.delivery.outbox import PendingTransitionDrain, next_state_revision
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
    scope_key = sha256(scope.encode()).hexdigest()
    key = f"anomaly-detection:hourly:v1:{get_local_cell().name}:{organization.id}:{scope_key}:{end.isoformat()}"
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
    states = AnomalyDetectionState.objects.using(db).filter(organization_id=organization_id)
    eligible_detectors = enabled_anomaly_detectors().filter(
        project__organization_id=organization_id
    )
    initial = states.values_list("id", "next_minute", "delivery").get_or_none()
    created = False
    if initial is None:
        if not eligible_detectors.exists():
            return False
        state, created = states.get_or_create(organization_id=organization_id)
        initial = state.id, state.next_minute, state.delivery
    state_id, cursor, raw_delivery = initial
    state_rows = states.filter(id=state_id)
    drain = PendingTransitionDrain(state_id, organization_id, db)
    target_utc = target.replace(tzinfo=UTC)
    has_pending = raw_delivery is not None and bool(raw_delivery["pending"])
    if cursor is not None and cursor >= target_utc:
        return drain.run() if has_pending else False
    if has_pending:
        # Give existing work a turn, but keep evaluation ahead of the remaining
        # broker waits. Both passes share a single delivery budget.
        drain.run(max_checks=1)

    # Read the revision together with the checkpoint, after our own queue writes
    # but before the final project scope query. Project deletion can now find and
    # invalidate this row even on the worker's first evaluation.
    snapshot = state_rows.values_list("next_minute", "date_updated", "checkpoint").get_or_none()
    if snapshot is None:
        return False
    next_minute, revision, previous_checkpoint = snapshot
    if next_minute is not None and next_minute >= target_utc:
        return drain.run()
    detector_rows = list(
        eligible_detectors.order_by("project_id", "id")
        .distinct("project_id")
        .select_related("project")[: _MAX_PROJECTS + 1]
    )
    if not detector_rows:
        if created:
            # The advisory lookup may have raced removal of the last detector.
            with transaction.atomic(using=db):
                empty = (
                    state_rows.select_for_update(skip_locked=True)
                    .filter(next_minute__isnull=True, date_updated=revision)
                    .get_or_none()
                )
                if empty is not None:
                    empty.delete(using=db)
        return drain.run() if has_pending else False
    if len(detector_rows) > _MAX_PROJECTS:
        raise RuntimeError("Anomaly detection organization exceeds the project limit")
    projects = [detector.linked_project for detector in detector_rows]
    detector_ids = {detector.linked_project.id: detector.id for detector in detector_rows}
    handlers = {
        str(detector.linked_project.id): get_anomaly_handler(detector) for detector in detector_rows
    }

    end = target
    if next_minute is None:
        # Collect warmup data, but only publish the active state at the boundary.
        publish_from = end - _MINUTE
        fetch_start = publish_from - _MINUTE_WARMUP
    else:
        fetch_start = publish_from = next_minute.astimezone(UTC).replace(tzinfo=None)
        end = min(end, publish_from + _MAX_CATCHUP)

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
    retained_keys = retained_group_keys(checkpoint)
    # A Redis lease can expire during evaluation. Fence against a newer evaluator,
    # queue progress, or deletion and stage only on the live locked delivery.
    with transaction.atomic(using=db):
        live = (
            state_rows.filter(next_minute=next_minute, date_updated=revision)
            .select_for_update(skip_locked=True)
            .values_list("delivery")
            .get_or_none()
        )
        if live is None:
            return False
        delivery = DeliveryState.from_json(live[0])
        delivery.stage(
            decisions,
            detector_ids,
            start=publish_from,
            end=end,
            retained_keys=retained_keys,
        )
        state_rows.update(
            next_minute=end.replace(tzinfo=UTC),
            checkpoint=checkpoint,
            delivery=delivery.to_json(),
            date_updated=next_state_revision(revision),
        )
    continue_draining = drain.run() if delivery.pending else False
    return end < target or continue_draining


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
