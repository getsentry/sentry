from __future__ import annotations

import logging
import uuid
from datetime import datetime

from django.db.models import Q
from django.utils import timezone

from sentry import features
from sentry.constants import ObjectStatus
from sentry.grouping.utils import hash_from_values
from sentry.issues.grouptype import (
    MonitorCheckInFailure,
    MonitorCheckInMissed,
    MonitorCheckInTimeout,
)
from sentry.models import Organization
from sentry.monitors.constants import SUBTITLE_DATETIME_FORMAT, TIMEOUT
from sentry.monitors.models import CheckInStatus, MonitorCheckIn, MonitorEnvironment, MonitorStatus

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
    failure_issue_threshold = monitor_env.monitor.config.get("failure_issue_threshold", 0)
    if failure_issue_threshold:
        return mark_failed_threshold(failure_issue_threshold, monitor_env, last_checkin)
    else:
        return mark_failed_no_threshold(monitor_env, last_checkin, reason, occurrence_context)


def mark_failed_threshold(
    failure_issue_threshold: int,
    monitor_env: MonitorEnvironment,
    last_checkin=None,
):
    from sentry.signals import monitor_environment_failed

    # update monitor environment timestamps on every check-in
    if last_checkin is None:
        next_checkin_base = timezone.now()
        last_checkin = monitor_env.last_checkin or timezone.now()
    else:
        next_checkin_base = last_checkin

    next_checkin = monitor_env.monitor.get_next_expected_checkin(next_checkin_base)
    next_checkin_latest = monitor_env.monitor.get_next_expected_checkin_latest(next_checkin_base)

    # update monitor environment timestamps without updating status
    affected = MonitorEnvironment.objects.filter(
        Q(last_checkin__lte=last_checkin) | Q(last_checkin__isnull=True), id=monitor_env.id
    ).update(
        next_checkin=next_checkin,
        next_checkin_latest=next_checkin_latest,
        last_checkin=last_checkin,
    )
    if not affected:
        return False

    # check to see if we need to update the status
    if monitor_env.status == MonitorStatus.OK:
        previous_checkins = MonitorCheckIn.objects.filter(monitor_environment=monitor_env).order_by(
            "-date_added"
        )[:failure_issue_threshold]
        # check for successive failed previous check-ins
        if not all(
            [
                checkin.status not in [CheckInStatus.IN_PROGRESS, CheckInStatus.OK]
                for checkin in previous_checkins
            ]
        ):
            return False

        # change monitor status + update fingerprint timestamp
        monitor_env.status = MonitorStatus.ERROR
        monitor_env.last_state_change = last_checkin
        monitor_env.save()
    elif monitor_env.status in [
        MonitorStatus.ERROR,
        MonitorStatus.MISSED_CHECKIN,
        MonitorStatus.TIMEOUT,
    ]:
        # if monitor environment has a failed status, get the most recent check-in and send occurrence
        previous_checkins = [
            MonitorCheckIn.objects.filter(monitor_environment=monitor_env)
            .order_by("-date_added")
            .first()
        ]
    else:
        # don't send occurrence for other statuses
        return False

    # Do not create event if monitor is disabled
    if monitor_env.monitor.status == ObjectStatus.DISABLED:
        return True

    fingerprint = [
        "monitor",
        str(monitor_env.monitor.guid),
        monitor_env.environment.name,
        str(monitor_env.last_state_change),
    ]
    for previous_checkin in previous_checkins:
        reason = get_reason_from_checkin(previous_checkin)
        occurrence_context = get_occurrence_context_from_checkin(previous_checkin)
        create_issue_platform_occurrence(monitor_env, reason, occurrence_context, fingerprint)

    monitor_environment_failed.send(monitor_environment=monitor_env, sender=type(monitor_env))

    return True


def mark_failed_no_threshold(
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

    use_issue_platform = False
    try:
        organization = Organization.objects.get(id=monitor_env.monitor.organization_id)
        use_issue_platform = features.has("organizations:issue-platform", organization=organization)
    except Organization.DoesNotExist:
        pass

    if use_issue_platform:
        create_issue_platform_occurrence(monitor_env, reason, occurrence_context)
    else:
        create_legacy_event(monitor_env, reason)

    monitor_environment_failed.send(monitor_environment=monitor_env, sender=type(monitor_env))

    return True


def create_legacy_event(monitor_env: MonitorEnvironment, reason: str):
    from sentry.coreapi import insert_data_to_database_legacy
    from sentry.event_manager import EventManager
    from sentry.models import Project

    context = get_monitor_environment_context(monitor_env)

    event_manager = EventManager(
        {
            "logentry": {"message": f"Monitor failure: {monitor_env.monitor.name} ({reason})"},
            "contexts": {"monitor": context},
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


def create_issue_platform_occurrence(
    monitor_env: MonitorEnvironment,
    reason: str,
    occurrence_context=None,
    fingerprint=None,
):
    from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
    from sentry.issues.producer import produce_occurrence_to_kafka

    current_timestamp = datetime.utcnow().replace(tzinfo=timezone.utc)

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
            hash_from_values(fingerprint)
            if fingerprint
            else hash_from_values(
                ["monitor", str(monitor_env.monitor.guid), occurrence_data["reason"]]
            )
        ],
        type=occurrence_data["group_type"],
        issue_title=f"Monitor failure: {monitor_env.monitor.name}",
        subtitle=occurrence_data["subtitle"],
        evidence_display=[
            IssueEvidence(name="Failure reason", value=occurrence_data["reason"], important=True),
            IssueEvidence(name="Environment", value=monitor_env.environment.name, important=False),
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

    trace_id = occurrence_context.get("trace_id")

    produce_occurrence_to_kafka(
        occurrence,
        {
            "contexts": {"monitor": get_monitor_environment_context(monitor_env)},
            "environment": monitor_env.environment.name,
            "event_id": occurrence.event_id,
            "fingerprint": fingerprint
            if fingerprint
            else [
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
            "trace_id": str(trace_id) if trace_id else None,
            "timestamp": current_timestamp.isoformat(),
        },
    )


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


def get_reason_from_checkin(checkin: MonitorCheckIn):
    reason = MonitorFailure.UNKNOWN
    if checkin.status == CheckInStatus.MISSED:
        reason = MonitorFailure.MISSED_CHECKIN
    elif checkin.status == CheckInStatus.TIMEOUT:
        reason = MonitorFailure.DURATION

    return reason


def get_occurrence_context_from_checkin(checkin: MonitorCheckIn):
    status = checkin.status
    if status == CheckInStatus.MISSED:
        expected_time = (
            checkin.expected_time.strftime(SUBTITLE_DATETIME_FORMAT)
            if checkin.expected_time
            else None
        )
        return {"expected_time": expected_time}
    elif status == CheckInStatus.TIMEOUT:
        duration = (checkin.monitor.config or {}).get("max_runtime") or TIMEOUT
        return {"duration": duration, "trace_id": checkin.trace_id}

    return {"trace_id": checkin.trace_id}


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
