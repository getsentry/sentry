from datetime import datetime

from sentry.monitors.models import (
    CheckInStatus,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorIncident,
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
        not monitor_env.monitor.is_muted
        and not monitor_env.is_muted
        and monitor_env.status != MonitorStatus.OK
    ):
        params["status"] = MonitorStatus.OK
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
                previous_checkin["status"] == CheckInStatus.OK
                for previous_checkin in previous_checkins
            )
        else:
            # Mark any open incidents as recovering by default
            incident_recovering = True

        # Resolve any open incidents
        if incident_recovering:
            # TODO(rjo100): Check for multiple open incidents where we only
            # resolved if recovery_threshold was set and not faiure_issue_threshold
            active_incidents = MonitorIncident.objects.filter(
                monitor_environment=monitor_env,
                resolving_checkin__isnull=True,
            )

            # Only send an occurrence if we have an active incident
            for grouphash in active_incidents.values_list("grouphash", flat=True):
                resolve_incident_group(grouphash, checkin.monitor.project_id)
            if active_incidents.update(
                resolving_checkin=checkin,
                resolving_timestamp=checkin.date_added,
            ):
                params["last_state_change"] = ts
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
