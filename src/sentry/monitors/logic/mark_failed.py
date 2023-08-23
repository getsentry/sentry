from __future__ import annotations

import logging
import uuid
from datetime import datetime

from django.db.models import Q
from django.utils import timezone

from sentry import features
from sentry.constants import ObjectStatus
from sentry.issues.grouptype import (
    MonitorCheckInFailure,
    MonitorCheckInMissed,
    MonitorCheckInTimeout,
)
from sentry.models import Organization
from sentry.monitors.models import MonitorEnvironment, MonitorStatus

logger = logging.getLogger(__name__)


class MonitorFailure:
    UNKNOWN = "unknown"
    MISSED_CHECKIN = "missed_checkin"
    DURATION = "duration"


def mark_failed(
    monitor_env: MonitorEnvironment,
    last_checkin=None,
    reason=MonitorFailure.UNKNOWN,
    occurrence_context=None,
):
    from sentry.signals import monitor_environment_failed

    if last_checkin is None:
        next_checkin_base = timezone.now()
        last_checkin = monitor_env.last_checkin or timezone.now()
    else:
        next_checkin_base = last_checkin

    new_status = MonitorStatus.ERROR
    if reason == MonitorFailure.MISSED_CHECKIN:
        new_status = MonitorStatus.MISSED_CHECKIN
    elif reason == MonitorFailure.DURATION:
        new_status = MonitorStatus.TIMEOUT

    next_checkin = monitor_env.monitor.get_next_expected_checkin(next_checkin_base)
    next_checkin_latest = monitor_env.monitor.get_next_expected_checkin_latest(next_checkin_base)

    affected = MonitorEnvironment.objects.filter(
        Q(last_checkin__lte=last_checkin) | Q(last_checkin__isnull=True), id=monitor_env.id
    ).update(
        next_checkin=next_checkin,
        next_checkin_latest=next_checkin_latest,
        status=new_status,
        last_checkin=last_checkin,
    )
    if not affected:
        return False

    # refresh the object from the database so we have the updated values
    monitor_env.refresh_from_db()

    # Do not create event if monitor is disabled
    if monitor_env.monitor.status == ObjectStatus.DISABLED:
        return True

    current_timestamp = datetime.utcnow().replace(tzinfo=timezone.utc)

    use_issue_platform = False
    try:
        organization = Organization.objects.get(id=monitor_env.monitor.organization_id)
        use_issue_platform = features.has("organizations:issue-platform", organization=organization)
    except Organization.DoesNotExist:
        pass

    if use_issue_platform:
        from sentry.grouping.utils import hash_from_values
        from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
        from sentry.issues.producer import produce_occurrence_to_kafka

        if not occurrence_context:
            occurrence_context = {}

        occurrence_data = get_occurrence_data(reason, **occurrence_context)

        # Get last successful check-in to show in evidence display
        last_successful_checkin_timestamp = "None"
        last_successful_checkin = monitor_env.get_last_successful_checkin()
        if last_successful_checkin:
            last_successful_checkin_timestamp = last_successful_checkin.date_added.isoformat()

        occurrence = IssueOccurrence(
            id=uuid.uuid4().hex,
            resource_id=None,
            project_id=monitor_env.monitor.project_id,
            event_id=uuid.uuid4().hex,
            fingerprint=[
                hash_from_values(
                    ["monitor", str(monitor_env.monitor.guid), occurrence_data["reason"]]
                )
            ],
            type=occurrence_data["group_type"],
            issue_title=f"Monitor failure: {monitor_env.monitor.name}",
            subtitle=occurrence_data["subtitle"],
            evidence_display=[
                IssueEvidence(
                    name="Failure reason", value=occurrence_data["reason"], important=True
                ),
                IssueEvidence(
                    name="Environment", value=monitor_env.environment.name, important=False
                ),
                IssueEvidence(
                    name="Last successful check-in",
                    value=last_successful_checkin_timestamp,
                    important=False,
                ),
            ],
            evidence_data={},
            culprit=occurrence_data["reason"],
            detection_time=current_timestamp,
            level=occurrence_data["level"],
        )

        produce_occurrence_to_kafka(
            occurrence,
            {
                "contexts": {"monitor": get_monitor_environment_context(monitor_env)},
                "environment": monitor_env.environment.name,
                "event_id": occurrence.event_id,
                "fingerprint": [
                    "monitor",
                    str(monitor_env.monitor.guid),
                    occurrence_data["reason"],
                ],
                "platform": "other",
                "project_id": monitor_env.monitor.project_id,
                "received": current_timestamp.isoformat(),
                "sdk": None,
                "tags": {
                    "monitor.id": str(monitor_env.monitor.guid),
                    "monitor.slug": monitor_env.monitor.slug,
                },
                "trace_id": occurrence_context.get("trace_id"),
                "timestamp": current_timestamp.isoformat(),
            },
        )
    else:
        from sentry.coreapi import insert_data_to_database_legacy
        from sentry.event_manager import EventManager
        from sentry.models import Project

        event_manager = EventManager(
            {
                "logentry": {"message": f"Monitor failure: {monitor_env.monitor.name} ({reason})"},
                "contexts": {"monitor": get_monitor_environment_context(monitor_env)},
                "fingerprint": ["monitor", str(monitor_env.monitor.guid), reason],
                "environment": monitor_env.environment.name,
                # TODO: Both of these values should be get transformed from context to tags
                # We should understand why that is not happening and remove these when it correctly is
                "tags": {
                    "monitor.id": str(monitor_env.monitor.guid),
                    "monitor.slug": monitor_env.monitor.slug,
                },
            },
            project=Project(id=monitor_env.monitor.project_id),
        )
        event_manager.normalize()
        data = event_manager.get_data()
        insert_data_to_database_legacy(data)

    monitor_environment_failed.send(monitor_environment=monitor_env, sender=type(monitor_env))
    return True


def get_monitor_environment_context(monitor_environment):
    config = monitor_environment.monitor.config.copy()
    if "schedule_type" in config:
        config["schedule_type"] = monitor_environment.monitor.get_schedule_type_display()

    return {
        "id": str(monitor_environment.monitor.guid),
        "slug": monitor_environment.monitor.slug,
        "name": monitor_environment.monitor.name,
        "config": monitor_environment.monitor.config,
        "status": monitor_environment.get_status_display(),
        "type": monitor_environment.monitor.get_type_display(),
    }


def get_occurrence_data(reason: str, **kwargs):
    if reason == MonitorFailure.MISSED_CHECKIN:
        expected_time = kwargs.get("expected_time", "the expected time")
        return {
            "group_type": MonitorCheckInMissed,
            "level": "warning",
            "reason": "missed_checkin",
            "subtitle": f"No check-in reported on {expected_time}.",
        }
    elif reason == MonitorFailure.DURATION:
        duration = kwargs.get("duration", 30)
        return {
            "group_type": MonitorCheckInTimeout,
            "level": "error",
            "reason": "duration",
            "subtitle": f"Check-in exceeded maximum duration of {duration} minutes.",
        }

    return {
        "group_type": MonitorCheckInFailure,
        "level": "error",
        "reason": "error",
        "subtitle": "An error occurred during the latest check-in.",
    }
