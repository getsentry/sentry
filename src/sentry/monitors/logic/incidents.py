from __future__ import annotations

import logging
from datetime import datetime
from typing import cast

from sentry.monitors.logic.incident_occurrence import create_incident_occurrence
from sentry.monitors.models import CheckInStatus, MonitorCheckIn, MonitorIncident, MonitorStatus
from sentry.monitors.types import SimpleCheckIn

logger = logging.getLogger(__name__)


def try_incident_threshold(
    failed_checkin: MonitorCheckIn,
    received: datetime | None,
) -> bool:
    from sentry.signals import monitor_environment_failed

    monitor_env = failed_checkin.monitor_environment

    if monitor_env is None:
        return False

    failure_issue_threshold = monitor_env.monitor.config.get("failure_issue_threshold", 1)
    if not failure_issue_threshold:
        failure_issue_threshold = 1

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
            create_incident_occurrence(
                previous_checkins,
                checkin,
                incident,
                received=received,
            )

    monitor_environment_failed.send(monitor_environment=monitor_env, sender=type(monitor_env))

    return True
