from datetime import datetime

from sentry.monitors.models import (
    CheckInStatus,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorIncident,
    MonitorObjectStatus,
    MonitorStatus,
)


def mark_ok(checkin: MonitorCheckIn, ts: datetime):
    monitor_env = checkin.monitor_environment

    next_checkin = monitor_env.monitor.get_next_expected_checkin(ts)
    next_checkin_latest = monitor_env.monitor.get_next_expected_checkin_latest(ts)

    params = {
        "last_checkin": checkin.date_added,
        "next_checkin": next_checkin,
        "next_checkin_latest": next_checkin_latest,
    }

    if (
        monitor_env.monitor.status != MonitorObjectStatus.DISABLED
        and monitor_env.status != MonitorStatus.OK
    ):
        params["status"] = MonitorStatus.OK
        recovery_threshold = monitor_env.monitor.config.get("recovery_threshold")

        # Run incident logic if recovery threshold is set
        if recovery_threshold:
            # Check if our incident is recovering
            previous_checkins = (
                MonitorCheckIn.objects.filter(monitor_environment=monitor_env)
                .values("id", "date_added", "status")
                .order_by("-date_added")[:recovery_threshold]
            )

            # Incident recovers when we have successive threshold check-ins
            incident_recovering = all(
                previous_checkin["status"] == CheckInStatus.OK
                for previous_checkin in previous_checkins
            )
        else:
            incident_recovering = True

        # Resolve the incident
        if incident_recovering:
            params["last_state_change"] = ts
            grouphash = monitor_env.incident_grouphash

            # Only send an occurrence if we have an active incident
            affected = MonitorIncident.objects.filter(
                monitor_environment=monitor_env,
                grouphash=grouphash,
            ).update(
                resolving_checkin=checkin,
                resolving_timestamp=checkin.date_added,
            )
            if affected:
                resolve_incident_group(grouphash, checkin.monitor.project_id)
        else:
            # Don't update status if incident isn't recovered
            params.pop("status", None)

    MonitorEnvironment.objects.filter(id=monitor_env.id).exclude(last_checkin__gt=ts).update(
        **params
    )


def resolve_incident_group(
    fingerprint: str,
    project_id: int,
):
    from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
    from sentry.issues.status_change_message import StatusChangeMessage
    from sentry.models.group import GroupStatus

    status_change = StatusChangeMessage(
        fingerprint=[fingerprint],
        project_id=project_id,
        new_status=GroupStatus.RESOLVED,
        new_substatus=None,
    )

    produce_occurrence_to_kafka(
        payload_type=PayloadType.STATUS_CHANGE,
        status_change=status_change,
    )
