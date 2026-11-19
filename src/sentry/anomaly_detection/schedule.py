from __future__ import annotations

import zlib
from collections import defaultdict
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from typing import Any

import orjson
from django.db import IntegrityError, router, transaction
from django.utils import timezone
from taskbroker_client.retry import Retry

from sentry import features, options
from sentry.anomaly_detection.checkpoint.codec import is_current
from sentry.anomaly_detection.checkpoint.replay import advance_org
from sentry.anomaly_detection.contracts import AnomalyGroupKey, Metric, SeriesRow, Signal
from sentry.anomaly_detection.evaluation.organization import AnomalyDecision
from sentry.anomaly_detection.grouptype import AnomalyDetection, MinuteDecisions
from sentry.anomaly_detection.inputs.measurements import collect
from sentry.anomaly_detection.inputs.new_failures import (
    collect_new_failure_modes,
    new_failure_thresholds,
)
from sentry.anomaly_detection.inputs.trace_lookup import TraceLookup
from sentry.constants import ObjectStatus
from sentry.db.models.manager.base_query_set import BaseQuerySet
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
from sentry.workflow_engine.models import DataPacket, Detector, DetectorState
from sentry.workflow_engine.processors.detector import process_detectors
from sentry.workflow_engine.types import DetectorType

FEATURE = "organizations:anomaly-detector"
_MINUTE = timedelta(minutes=1)
_INGEST_DELAY = timedelta(minutes=2)
_MINUTE_WARMUP = timedelta(hours=5)
_HOURLY_LOOKBACK = timedelta(days=16)
# State that hasn't advanced this long belongs to an organization that stopped evaluating.
_ABANDONED_STATE_AGE = timedelta(days=1)
_RESOLVED_STATE_RETENTION = timedelta(days=30)
_MAX_CACHE_BYTES = 900_000


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
    now = timezone.now()
    AnomalyDetectionState.objects.filter(date_updated__lt=now - _ABANDONED_STATE_AGE).delete()
    # Every anomaly episode has its own group key, so resolved detector state only grows.
    DetectorState.objects.filter(
        detector__type=DetectorType.ANOMALY_DETECTION.value,
        is_triggered=False,
        date_updated__lt=now - _RESOLVED_STATE_RETENTION,
    ).delete()

    max_organizations = options.get("anomaly_detection.max_organizations_per_tick")
    cursor_key = f"anomaly-detection:fanout:v1:{get_local_cell().name}"
    after = cache.get(cursor_key, 0)
    candidates = (
        _enabled_detectors()
        .order_by("project__organization_id")
        .values_list("project__organization_id", flat=True)
        .distinct()
    )
    organization_ids = list(
        candidates.filter(project__organization_id__gt=after)[:max_organizations]
    )
    if len(organization_ids) < max_organizations and after:
        spare = max_organizations - len(organization_ids)
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
) -> list[SeriesRow]:
    end = end.replace(minute=0)
    scope = ":".join(str(project.id) for project in projects)
    scope_key = sha256(scope.encode()).hexdigest()
    key = f"anomaly-detection:hourly:v2:{get_local_cell().name}:{organization.id}:{scope_key}:{end.isoformat()}"
    payload = cache.get(key)
    if payload is not None:
        try:
            return [
                SeriesRow(
                    datetime.fromisoformat(ts),
                    Signal(signal),
                    Metric(metric),
                    project_id,
                    env,
                    dim_value,
                    value,
                )
                for ts, signal, metric, project_id, env, dim_value, value in orjson.loads(
                    zlib.decompress(payload)
                )
            ]
        except (zlib.error, orjson.JSONDecodeError, TypeError, ValueError):
            metrics.incr("anomaly_detection.hourly_snapshot_corrupt")
            cache.delete(key)
    rows = collect(organization, projects, end - _HOURLY_LOOKBACK, end, "1h")
    # orjson encodes tuples but not named tuples.
    payload = zlib.compress(orjson.dumps([tuple(row) for row in rows]))
    if len(payload) <= _MAX_CACHE_BYTES:
        cache.set(key, payload, 3600)
    else:
        metrics.incr("anomaly_detection.hourly_snapshot_too_large")
    return rows


def _publish(decisions: Sequence[AnomalyDecision], detectors: Mapping[int, Detector]) -> None:
    """Send decisions through Workflow Engine in minute order.

    The stateful handler skips minutes a group already processed, so republishing
    after a failed checkpoint commit doesn't duplicate issue transitions.
    """
    decisions_by_minute: dict[tuple[datetime, int], dict[AnomalyGroupKey, AnomalyDecision]] = (
        defaultdict(dict)
    )
    for decision in decisions:
        if decision.project_id in detectors:
            minute_decisions = decisions_by_minute[decision.timestamp, decision.project_id]
            minute_decisions[decision.group_key] = decision
    for (minute, project_id), minute_decisions in sorted(decisions_by_minute.items()):
        detector = detectors[project_id]
        packet = DataPacket(
            source_id=str(detector.id),
            packet=MinuteDecisions(minute=minute, decisions=minute_decisions),
        )
        process_detectors(packet, [detector])


def _commit_checkpoint(
    organization_id: int,
    *,
    stored_minute: datetime | None,
    next_minute: datetime,
    checkpoint: dict[str, Any],
) -> bool:
    """Compare-and-set the checkpoint; return False if another worker advanced it first.

    `stored_minute` is the cursor read before evaluating, or None if there was no row.
    """
    if stored_minute is None:
        try:
            with transaction.atomic(using=router.db_for_write(AnomalyDetectionState)):
                AnomalyDetectionState.objects.create(
                    organization_id=organization_id, next_minute=next_minute, checkpoint=checkpoint
                )
        except IntegrityError:
            return False
        return True
    return bool(
        AnomalyDetectionState.objects.filter(
            organization_id=organization_id, next_minute=stored_minute
        ).update(next_minute=next_minute, checkpoint=checkpoint, date_updated=timezone.now())
    )


def _run_organization(organization_id: int, target: datetime) -> bool:
    """Make one bounded unit of progress; return whether to enqueue a continuation."""
    organization = Organization.objects.get_or_none(
        id=organization_id, status=OrganizationStatus.ACTIVE
    )
    if organization is None or not _eligible(organization):
        return False

    max_projects = options.get("anomaly_detection.max_projects_per_organization")
    detector_rows = list(
        _enabled_detectors()
        .filter(project__organization_id=organization_id)
        .order_by("project_id", "id")
        .distinct("project_id")
        .select_related("project")[: max_projects + 1]
    )
    if not detector_rows:
        AnomalyDetectionState.objects.filter(organization_id=organization_id).delete()
        return False
    if len(detector_rows) > max_projects:
        metrics.incr("anomaly_detection.project_limit_exceeded")
        return False
    detectors = {detector.linked_project.id: detector for detector in detector_rows}
    projects = [detector.linked_project for detector in detector_rows]

    stored = (
        AnomalyDetectionState.objects.filter(organization_id=organization_id)
        .values_list("next_minute", "checkpoint")
        .get_or_none()
    )
    stored_minute, checkpoint = stored if stored is not None else (None, None)
    if checkpoint is not None and not is_current(checkpoint):
        metrics.incr("anomaly_detection.checkpoint_discarded")
        checkpoint = None
    resume_minute = stored_minute if checkpoint is not None else None
    target_utc = target.replace(tzinfo=UTC)
    if resume_minute is not None and resume_minute >= target_utc:
        return False

    end = target
    if resume_minute is None:
        # Collect warmup data, but only publish the active state at the boundary.
        publish_from = end - _MINUTE
        fetch_start = publish_from - _MINUTE_WARMUP
    else:
        fetch_start = publish_from = resume_minute.astimezone(UTC).replace(tzinfo=None)
        max_catchup = timedelta(minutes=options.get("anomaly_detection.max_catchup_minutes"))
        end = min(end, publish_from + max_catchup)

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
    decisions, next_checkpoint = advance_org(
        rows=rows,
        hourly_rows=hourly_rows,
        start=publish_from,
        end=end,
        footprints=TraceLookup(organization, projects),
        new_issues=new_issues,
        checkpoint=checkpoint,
        projects=detectors.keys(),
    )
    metrics.distribution("anomaly_detection.checkpoint_bytes", len(orjson.dumps(next_checkpoint)))
    # Publish before committing: a crash in between replays the same minutes, which
    # the detectors' per-group dedupe ignores. Committing first could lose transitions.
    _publish(decisions, detectors)
    committed = _commit_checkpoint(
        organization_id,
        stored_minute=stored_minute,
        next_minute=end.replace(tzinfo=UTC),
        checkpoint=next_checkpoint,
    )
    if not committed:
        metrics.incr("anomaly_detection.checkpoint_conflict")
    return committed and end < target


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
