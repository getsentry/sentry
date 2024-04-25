from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from django.db.models import Q

from sentry import features
from sentry.issues.grouptype import (
    MonitorCheckInFailure,
    MonitorCheckInMissed,
    MonitorCheckInTimeout,
)
from sentry.models.organization import Organization
from sentry.monitors.constants import SUBTITLE_DATETIME_FORMAT, TIMEOUT
from sentry.monitors.models import (
    CheckInStatus,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorIncident,
    MonitorStatus,
)

logger = logging.getLogger(__name__)


def mark_failed(
    failed_checkin: MonitorCheckIn,
    ts: datetime,
    received: datetime | None = None,
):
    """
    Given a failing check-in, mark the monitor environment as failed and trigger
    side effects for creating monitor incidents and issues.

    The provided `ts` is the reference time for when the next check-in time is
    calculated from. This typically would be the failed check-in's `date_added`
    or completion time. Though for the missed and timedout tasks this may be
    computed based on the tasks reference time.
    """
    monitor_env = failed_checkin.monitor_environment
    failure_issue_threshold = monitor_env.monitor.config.get("failure_issue_threshold", 1)
    if not failure_issue_threshold:
        failure_issue_threshold = 1

    # Compute the next check-in time from our reference time
    next_checkin = monitor_env.monitor.get_next_expected_checkin(ts)
    next_checkin_latest = monitor_env.monitor.get_next_expected_checkin_latest(ts)

    # When the failed check-in is a synthetic missed check-in we do not move
    # the `last_checkin` timestamp forward.
    if failed_checkin.status == CheckInStatus.MISSED:
        # When a monitor is MISSED it MUST have already had a `last_checkin`. A
        # monitor cannot be missed without having checked in.
        last_checkin = monitor_env.last_checkin
    else:
        last_checkin = failed_checkin.date_added

    # Select the MonitorEnvironment for update. We ONLY want to update the
    # monitor if there have not been newer check-ins.
    monitors_to_update = MonitorEnvironment.objects.filter(
        Q(last_checkin__lte=last_checkin) | Q(last_checkin__isnull=True),
        id=monitor_env.id,
    )

    field_updates = {
        "last_checkin": last_checkin,
        "next_checkin": next_checkin,
        "next_checkin_latest": next_checkin_latest,
    }

    affected = monitors_to_update.update(**field_updates)

    # If we did not update the monitor environment it means there was a newer
    # check-in. We have nothing to do in this case.
    #
    # XXX: The `affected` result is the number of rows returned from the
    # filter. Not the number of rows that had their values modified by the
    # update.
    if not affected:
        return False

    # refresh the object from the database so we have the updated values in our
    # cached instance
    monitor_env.refresh_from_db()

    # Create incidents + issues
    try:
        organization = Organization.objects.get_from_cache(id=monitor_env.monitor.organization_id)
        use_issue_platform = features.has("organizations:issue-platform", organization=organization)
    except Organization.DoesNotExist:
        use_issue_platform = False

    if use_issue_platform:
        return mark_failed_threshold(failed_checkin, failure_issue_threshold, received)
    else:
        return mark_failed_no_threshold(failed_checkin)


def mark_failed_threshold(
    failed_checkin: MonitorCheckIn, failure_issue_threshold: int, received: datetime | None
):
    from sentry.signals import monitor_environment_failed

    monitor_env = failed_checkin.monitor_environment

    # check to see if we need to update the status
    if monitor_env.status in [MonitorStatus.OK, MonitorStatus.ACTIVE]:
        if failure_issue_threshold == 1:
            previous_checkins = [
                {
                    "id": failed_checkin.id,
                    "date_added": failed_checkin.date_added,
                    "status": failed_checkin.status,
                }
            ]
        else:
            previous_checkins = (
                # Using .values for performance reasons
                MonitorCheckIn.objects.filter(
                    monitor_environment=monitor_env, date_added__lte=failed_checkin.date_added
                )
                .order_by("-date_added")
                .values("id", "date_added", "status")
            )

            # reverse the list after slicing in order to start with oldest check-in
            previous_checkins = list(reversed(previous_checkins[:failure_issue_threshold]))

            # If we have any successful check-ins within the threshold of
            # commits we have NOT reached an incident state
            if any([checkin["status"] == CheckInStatus.OK for checkin in previous_checkins]):
                return False

        # change monitor status + update fingerprint timestamp
        monitor_env.status = MonitorStatus.ERROR
        monitor_env.save(update_fields=("status",))

        starting_checkin = previous_checkins[0]

        incident, _ = MonitorIncident.objects.get_or_create(
            monitor_environment=monitor_env,
            resolving_checkin=None,
            defaults={
                "monitor": monitor_env.monitor,
                "starting_checkin_id": starting_checkin["id"],
                "starting_timestamp": starting_checkin["date_added"],
            },
        )

    elif monitor_env.status == MonitorStatus.ERROR:
        # if monitor environment has a failed status, use the failed
        # check-in and send occurrence
        previous_checkins = [
            {
                "id": failed_checkin.id,
                "date_added": failed_checkin.date_added,
                "status": failed_checkin.status,
            }
        ]

        # get the active incident from the monitor environment
        incident = monitor_env.active_incident
    else:
        # don't send occurrence for other statuses
        return False

    # Only create an occurrence if:
    # - We have an active incident and fingerprint
    # - The monitor and env are not muted
    if not monitor_env.monitor.is_muted and not monitor_env.is_muted and incident:
        checkins = MonitorCheckIn.objects.filter(id__in=[c["id"] for c in previous_checkins])
        for previous_checkin in checkins:
            create_issue_platform_occurrence(previous_checkin, incident, received=received)

    monitor_environment_failed.send(monitor_environment=monitor_env, sender=type(monitor_env))

    return True


def mark_failed_no_threshold(failed_checkin: MonitorCheckIn):
    from sentry.signals import monitor_environment_failed

    monitor_env = failed_checkin.monitor_environment

    monitor_env.update(status=MonitorStatus.ERROR)

    # Do not create event if monitor or monitor environment is muted
    if monitor_env.monitor.is_muted or monitor_env.is_muted:
        return True

    create_legacy_event(failed_checkin)

    monitor_environment_failed.send(monitor_environment=monitor_env, sender=type(monitor_env))

    return True


def create_legacy_event(failed_checkin: MonitorCheckIn):
    from sentry.coreapi import insert_data_to_database_legacy
    from sentry.event_manager import EventManager
    from sentry.models.project import Project

    monitor_env = failed_checkin.monitor_environment
    context = get_monitor_environment_context(monitor_env)

    # XXX(epurkhiser): This matches up with the occurrence_data reason
    reason_map = {
        CheckInStatus.MISSED: "missed_checkin",
        CheckInStatus.TIMEOUT: "duration",
    }
    reason = reason_map.get(failed_checkin.status, "unknown")

    event_manager = EventManager(
        {
            "logentry": {"message": f"Monitor failure: {monitor_env.monitor.name} ({reason})"},
            "contexts": {"monitor": context},
            "fingerprint": ["monitor", str(monitor_env.monitor.guid), reason],
            "environment": monitor_env.get_environment().name,
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
    failed_checkin: MonitorCheckIn,
    incident: MonitorIncident,
    received: datetime | None,
):
    from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
    from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka

    monitor_env = failed_checkin.monitor_environment
    current_timestamp = datetime.now(timezone.utc)

    occurrence_data = get_occurrence_data(failed_checkin)

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
        fingerprint=[incident.grouphash],
        type=occurrence_data["group_type"],
        issue_title=f"Monitor failure: {monitor_env.monitor.name}",
        subtitle=occurrence_data["subtitle"],
        evidence_display=[
            IssueEvidence(name="Failure reason", value=occurrence_data["reason"], important=True),
            IssueEvidence(
                name="Environment", value=monitor_env.get_environment().name, important=False
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
        assignee=monitor_env.monitor.owner_actor,
    )

    if failed_checkin.trace_id:
        trace_id = failed_checkin.trace_id.hex
    else:
        trace_id = None

    event_data = {
        "contexts": {"monitor": get_monitor_environment_context(monitor_env)},
        "environment": monitor_env.get_environment().name,
        "event_id": occurrence.event_id,
        "fingerprint": [incident.grouphash],
        "platform": "other",
        "project_id": monitor_env.monitor.project_id,
        # We set this to the time that the checkin that triggered the occurrence was written to relay if available
        "received": (received if received else current_timestamp).isoformat(),
        "sdk": None,
        "tags": {
            "monitor.id": str(monitor_env.monitor.guid),
            "monitor.slug": str(monitor_env.monitor.slug),
            "monitor.incident": str(incident.id),
        },
        "timestamp": current_timestamp.isoformat(),
    }

    if trace_id:
        event_data["contexts"]["trace"] = {"trace_id": trace_id, "span_id": None}

    produce_occurrence_to_kafka(
        payload_type=PayloadType.OCCURRENCE,
        occurrence=occurrence,
        event_data=event_data,
    )


def get_monitor_environment_context(monitor_environment: MonitorEnvironment):
    config = monitor_environment.monitor.config.copy()
    if "schedule_type" in config:
        config["schedule_type"] = monitor_environment.monitor.get_schedule_type_display()

    return {
        "id": str(monitor_environment.monitor.guid),
        "slug": str(monitor_environment.monitor.slug),
        "name": monitor_environment.monitor.name,
        "config": monitor_environment.monitor.config,
        "status": monitor_environment.get_status_display(),
        "type": monitor_environment.monitor.get_type_display(),
    }


def get_occurrence_data(checkin: MonitorCheckIn):
    if checkin.status == CheckInStatus.MISSED:
        expected_time = (
            checkin.expected_time.astimezone(checkin.monitor.timezone).strftime(
                SUBTITLE_DATETIME_FORMAT
            )
            if checkin.expected_time
            else "the expected time"
        )
        return {
            "group_type": MonitorCheckInMissed,
            "level": "warning",
            "reason": "missed_checkin",
            "subtitle": f"No check-in reported on {expected_time}.",
        }

    if checkin.status == CheckInStatus.TIMEOUT:
        duration = (checkin.monitor.config or {}).get("max_runtime") or TIMEOUT
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
