from __future__ import annotations

import logging
from datetime import datetime, timedelta

from django.utils import timezone

from sentry import analytics
from sentry.monitors.logic.incident_occurrence import (
    create_incident_occurrence,
    resolve_incident_group,
)
from sentry.monitors.models import CheckInStatus, MonitorCheckIn, MonitorIncident, MonitorStatus
from sentry.monitors.tasks.detect_broken_monitor_envs import NUM_DAYS_BROKEN_PERIOD
from sentry.monitors.types import SimpleCheckIn

logger = logging.getLogger(__name__)


def try_incident_threshold(
    failed_checkin: MonitorCheckIn,
    received: datetime | None,
) -> bool:
    """
    Determine if a monitor environment has reached it's incident threshold
    given the most recent failed check-in. When the threshold is reached a
    MonitorIncident will be created and an incident occurrence will be
    dispatched, which will later produce an issue occurrence.

    If an incident already exists additional occurrences will be dispatched.

    Returns True if we produce an incident occurrence.
    """
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
            previous_checkins: list[SimpleCheckIn] = [failed_checkin.as_simple_checkin()]
        else:
            previous_checkins = [
                SimpleCheckIn(**row)
                for row in
                # Using .values for performance reasons
                MonitorCheckIn.objects.filter(
                    monitor_environment=monitor_env, date_added__lte=failed_checkin.date_added
                )
                .order_by("-date_added")
                .values("id", "date_added", "status")
            ]

            # reverse the list after slicing in order to start with oldest check-in
            previous_checkins = list(reversed(previous_checkins[:failure_issue_threshold]))

            # If we have any successful check-ins within the threshold of
            # commits we have NOT reached an incident state
            if any([checkin.status == CheckInStatus.OK for checkin in previous_checkins]):
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
                "starting_checkin_id": starting_checkin.id,
                "starting_timestamp": starting_checkin.date_added,
            },
        )

    elif monitor_env.status == MonitorStatus.ERROR:
        # if monitor environment has a failed status, use the failed
        # check-in and send occurrence
        previous_checkins = [failed_checkin.as_simple_checkin()]

        # get the active incident from the monitor environment
        incident = monitor_env.active_incident
    else:
        # don't send occurrence for other statuses
        return False

    # Only create an occurrence if:
    # - We have an active incident and fingerprint
    # - The monitor and env are not muted
    if not monitor_env.monitor.is_muted and not monitor_env.is_muted and incident:
        checkins = MonitorCheckIn.objects.filter(id__in=[c.id for c in previous_checkins])
        for checkin in checkins:
            create_incident_occurrence(
                previous_checkins,
                checkin,
                incident,
                received=received,
            )

    monitor_environment_failed.send(monitor_environment=monitor_env, sender=type(monitor_env))

    return True


def try_incident_resolution(ok_checkin: MonitorCheckIn) -> bool:
    """
    Attempt to resolve any open incidents for a monitor given he most recent
    successful check-in.

    Returns True if the incident was resolved.
    """
    monitor_env = ok_checkin.monitor_environment

    if monitor_env is None:
        return False

    if monitor_env.status == MonitorStatus.OK or ok_checkin.status != CheckInStatus.OK:
        return False

    recovery_threshold = monitor_env.monitor.config.get("recovery_threshold", 1)
    if not recovery_threshold:
        recovery_threshold = 1

    # Run incident logic if recovery threshold is set
    if recovery_threshold > 1:
        # Check if our incident is recovering
        previous_checkins = (
            MonitorCheckIn.objects.filter(monitor_environment=monitor_env)
            .values("id", "date_added", "status")
            .order_by("-date_added")[:recovery_threshold]
        )

        # Incident recovers when we have successive threshold check-ins
        incident_recovering = all(
            previous_checkin["status"] == CheckInStatus.OK for previous_checkin in previous_checkins
        )
    else:
        # Mark any open incidents as recovering by default
        incident_recovering = True

    if not incident_recovering:
        return False

    incident = monitor_env.active_incident
    if incident:
        resolve_incident_group(incident, ok_checkin.monitor.project_id)
        incident.update(
            resolving_checkin=ok_checkin,
            resolving_timestamp=ok_checkin.date_added,
        )
        logger.info(
            "monitors.logic.mark_ok.resolving_incident",
            extra={
                "monitor_env_id": monitor_env.id,
                "incident_id": incident.id,
                "grouphash": incident.grouphash,
            },
        )
        # if incident was longer than the broken env time, check if there was a
        # broken detection that is also now resolved
        if (
            incident.starting_timestamp is not None
            and incident.starting_timestamp
            <= timezone.now() - timedelta(days=NUM_DAYS_BROKEN_PERIOD)
        ):
            if incident.monitorenvbrokendetection_set.exists():
                analytics.record(
                    "cron_monitor_broken_status.recovery",
                    organization_id=monitor_env.monitor.organization_id,
                    project_id=monitor_env.monitor.project_id,
                    monitor_id=monitor_env.monitor.id,
                    monitor_env_id=monitor_env.id,
                )

    return True
