from __future__ import annotations

import logging
import uuid
from collections import Counter
from collections.abc import Mapping, Sequence
from datetime import datetime, timezone
from typing import TYPE_CHECKING, TypedDict, cast

from django.db.models import Q
from django.utils.text import get_text_list
from django.utils.translation import gettext_lazy as _

from sentry.issues.grouptype import MonitorIncidentType
from sentry.monitors.models import (
    CheckInStatus,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorIncident,
    MonitorStatus,
)

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from django.utils.functional import _StrPromise


def mark_failed(
    failed_checkin: MonitorCheckIn,
    ts: datetime,
    received: datetime | None = None,
) -> bool:
    """
    Given a failing check-in, mark the monitor environment as failed and trigger
    side effects for creating monitor incidents and issues.

    The provided `ts` is the reference time for when the next check-in time is
    calculated from. This typically would be the failed check-in's `date_added`
    or completion time. Though for the missed and timedout tasks this may be
    computed based on the tasks reference time.
    """
    monitor_env = failed_checkin.monitor_environment

    if monitor_env is None:
        return False

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
    return mark_failed_threshold(failed_checkin, failure_issue_threshold, received)


class SimpleCheckIn(TypedDict):
    id: int
    date_added: datetime
    status: int


def mark_failed_threshold(
    failed_checkin: MonitorCheckIn,
    failure_issue_threshold: int,
    received: datetime | None,
) -> bool:
    from sentry.signals import monitor_environment_failed

    monitor_env = failed_checkin.monitor_environment

    if monitor_env is None:
        return False

    # check to see if we need to update the status
    if monitor_env.status in [MonitorStatus.OK, MonitorStatus.ACTIVE]:
        if failure_issue_threshold == 1:
            previous_checkins: list[SimpleCheckIn] = [
                {
                    "id": failed_checkin.id,
                    "date_added": failed_checkin.date_added,
                    "status": failed_checkin.status,
                }
            ]
        else:
            previous_checkins = cast(
                list[SimpleCheckIn],
                # Using .values for performance reasons
                MonitorCheckIn.objects.filter(
                    monitor_environment=monitor_env, date_added__lte=failed_checkin.date_added
                )
                .order_by("-date_added")
                .values("id", "date_added", "status"),
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

        incident: MonitorIncident | None
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
        for checkin in checkins:
            create_issue_platform_occurrence(
                previous_checkins,
                checkin,
                incident,
                received=received,
            )

    monitor_environment_failed.send(monitor_environment=monitor_env, sender=type(monitor_env))

    return True


def create_issue_platform_occurrence(
    failed_checkins: Sequence[SimpleCheckIn],
    failed_checkin: MonitorCheckIn,
    incident: MonitorIncident,
    received: datetime | None,
) -> None:
    from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
    from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka

    monitor_env = failed_checkin.monitor_environment

    if monitor_env is None:
        return

    current_timestamp = datetime.now(timezone.utc)

    # Get last successful check-in to show in evidence display
    last_successful_checkin_timestamp = "Never"
    last_successful_checkin = monitor_env.get_last_successful_checkin()
    if last_successful_checkin:
        last_successful_checkin_timestamp = last_successful_checkin.date_added.isoformat()

    occurrence = IssueOccurrence(
        id=uuid.uuid4().hex,
        resource_id=None,
        project_id=monitor_env.monitor.project_id,
        event_id=uuid.uuid4().hex,
        fingerprint=[incident.grouphash],
        type=MonitorIncidentType,
        issue_title=f"Monitor failure: {monitor_env.monitor.name}",
        subtitle="Your monitor has reached its failure threshold.",
        evidence_display=[
            IssueEvidence(
                name="Failure reason",
                value=str(get_failure_reason(failed_checkins)),
                important=True,
            ),
            IssueEvidence(
                name="Environment",
                value=monitor_env.get_environment().name,
                important=False,
            ),
            IssueEvidence(
                name="Last successful check-in",
                value=last_successful_checkin_timestamp,
                important=False,
            ),
        ],
        evidence_data={},
        culprit="",
        detection_time=current_timestamp,
        level="error",
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


HUMAN_FAILURE_STATUS_MAP: Mapping[int, _StrPromise] = {
    CheckInStatus.ERROR: _("error"),
    CheckInStatus.MISSED: _("missed"),
    CheckInStatus.TIMEOUT: _("timeout"),
}

# Exists due to the vowel differences (A vs An) in the statuses
SINGULAR_HUMAN_FAILURE_MAP: Mapping[int, _StrPromise] = {
    CheckInStatus.ERROR: _("An error check-in was detected"),
    CheckInStatus.MISSED: _("A missed check-in was detected"),
    CheckInStatus.TIMEOUT: _("A timeout check-in was detected"),
}


def get_failure_reason(failed_checkins: Sequence[SimpleCheckIn]):
    """
    Builds a humam readible string from a list of failed check-ins.

    "3 missed check-ins detected"
    "2 missed check-ins, 1 timeout check-in and 1 error check-in were detected"
    "A failed check-in was detected"
    """

    status_counts = Counter(
        checkin["status"]
        for checkin in failed_checkins
        if checkin["status"] in HUMAN_FAILURE_STATUS_MAP.keys()
    )

    if sum(status_counts.values()) == 1:
        return SINGULAR_HUMAN_FAILURE_MAP[list(status_counts.keys())[0]]

    human_status = get_text_list(
        [
            "%(count)d %(status)s" % {"count": count, "status": HUMAN_FAILURE_STATUS_MAP[status]}
            for status, count in status_counts.items()
        ],
        last_word=_("and"),
    )

    return _("%(problem_checkins)s check-ins detected") % {"problem_checkins": human_status}


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
