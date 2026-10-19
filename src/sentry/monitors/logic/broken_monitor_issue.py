from __future__ import annotations

import logging
import uuid
from datetime import datetime

from django.core.cache import cache
from django.db import router, transaction
from django.utils import timezone
from rest_framework import serializers

from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.locks import locks
from sentry.models.group import GroupStatus
from sentry.models.project import Project
from sentry.monitors.grouptype import BrokenMonitorConfigurationType
from sentry.monitors.logic.incident_occurrence import get_monitor_environment_context
from sentry.monitors.models import MonitorEnvironment, MonitorIncident
from sentry.types.actor import Actor, validate_actor
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.models.detector import get_detector_project_type_cache_key

logger = logging.getLogger(__name__)


def build_broken_monitor_fingerprint(monitor_env: MonitorEnvironment) -> list[str]:
    return [f"crons-broken:{monitor_env.id}"]


def ensure_broken_monitor_detector(project: Project) -> Detector:
    """
    Every issue platform group is expected to belong to a detector. We use a
    per-project detector of the configuration type rather than the cron
    monitor's own detector so that alerts connected to the cron monitor are
    not triggered by this low priority configuration issue.
    """
    slug = BrokenMonitorConfigurationType.slug
    try:
        return Detector.get_default_detector_for_project(project.id, slug)
    except Detector.DoesNotExist:
        pass

    lock = locks.get(
        f"broken-cron-monitor-detector:{project.id}",
        duration=2,
        name="broken_cron_monitor_detector_provision",
    )
    with (
        lock.blocking_acquire(initial_delay=0.1, timeout=3),
        transaction.atomic(router.db_for_write(Detector)),
    ):
        detector = Detector.objects.filter(type=slug, project=project).first()
        if detector is None:
            detector = Detector.objects.create(
                type=slug,
                project=project,
                name=BrokenMonitorConfigurationType.description,
                config={},
            )

    cache.set(get_detector_project_type_cache_key(project.id, slug), detector, Detector.CACHE_TTL)
    return detector


def _get_valid_owner(monitor_env: MonitorEnvironment) -> Actor | None:
    owner_actor = monitor_env.monitor.owner_actor
    if owner_actor is None:
        return None
    try:
        validate_actor(owner_actor, monitor_env.monitor.organization_id)
    except serializers.ValidationError:
        return None
    return owner_actor


def send_broken_monitor_occurrence(
    incident: MonitorIncident,
    project: Project,
    muted_timestamp: datetime | None = None,
) -> None:
    """
    Produce a broken monitor configuration issue occurrence for the incident's
    monitor environment. Called once when the environment is detected as
    broken, and again when it is automatically muted so the issue reflects it.
    """
    monitor_env = incident.monitor_environment
    assert monitor_env is not None
    monitor = monitor_env.monitor
    environment_name = monitor_env.get_environment().name
    detector = ensure_broken_monitor_detector(project)
    fingerprint = build_broken_monitor_fingerprint(monitor_env)
    now = timezone.now()

    last_successful_checkin = monitor_env.get_last_successful_checkin()
    last_successful_checkin_timestamp = (
        last_successful_checkin.date_added.isoformat() if last_successful_checkin else "Never"
    )

    if muted_timestamp is None:
        subtitle = (
            "This monitor has been failing for an extended period. Check its "
            "schedule and configuration, or disable it if it's no longer needed."
        )
    else:
        subtitle = (
            "This monitor has been failing for an extended period and was automatically muted."
        )

    evidence_display = [
        IssueEvidence(name="Environment", value=environment_name, important=True),
        IssueEvidence(
            name="Failing since",
            value=incident.starting_timestamp.isoformat() if incident.starting_timestamp else "",
            important=False,
        ),
        IssueEvidence(
            name="Last successful check-in",
            value=last_successful_checkin_timestamp,
            important=False,
        ),
    ]
    if muted_timestamp is not None:
        evidence_display.append(
            IssueEvidence(name="Muted at", value=muted_timestamp.isoformat(), important=False)
        )

    occurrence = IssueOccurrence(
        id=uuid.uuid4().hex,
        resource_id=None,
        project_id=project.id,
        event_id=uuid.uuid4().hex,
        fingerprint=fingerprint,
        type=BrokenMonitorConfigurationType,
        issue_title=f"Broken cron monitor: {monitor.name}",
        subtitle=subtitle,
        evidence_display=evidence_display,
        evidence_data={
            "detector_id": detector.id,
            "monitor_id": monitor.id,
            "monitor_environment_id": monitor_env.id,
            "monitor_incident_id": incident.id,
            "muted": muted_timestamp is not None,
        },
        culprit="",
        detection_time=now,
        level="warning",
        assignee=_get_valid_owner(monitor_env),
    )

    event_data = {
        "contexts": {"monitor": get_monitor_environment_context(monitor_env)},
        "environment": environment_name,
        "event_id": occurrence.event_id,
        "fingerprint": fingerprint,
        "platform": "other",
        "project_id": project.id,
        "received": now.isoformat(),
        "sdk": None,
        "tags": {
            "monitor.id": str(monitor.guid),
            "monitor.slug": str(monitor.slug),
            "monitor.incident": str(incident.id),
        },
        "timestamp": now.isoformat(),
    }

    produce_occurrence_to_kafka(
        payload_type=PayloadType.OCCURRENCE,
        occurrence=occurrence,
        event_data=event_data,
    )


def resolve_broken_monitor_issue(monitor_env: MonitorEnvironment, resolved_at: datetime) -> None:
    status_change = StatusChangeMessage(
        fingerprint=build_broken_monitor_fingerprint(monitor_env),
        project_id=monitor_env.monitor.project_id,
        new_status=GroupStatus.RESOLVED,
        new_substatus=None,
        update_date=resolved_at,
    )
    produce_occurrence_to_kafka(
        payload_type=PayloadType.STATUS_CHANGE,
        status_change=status_change,
    )
