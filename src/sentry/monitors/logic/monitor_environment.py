from typing import int
from datetime import datetime

from sentry.monitors.models import CheckInStatus, MonitorCheckIn, MonitorEnvironment


def monitor_has_newer_status_affecting_checkins(
    monitor_env: MonitorEnvironment, timestamp: datetime
):
    return MonitorCheckIn.objects.filter(
        monitor_environment=monitor_env,
        date_added__gt=timestamp,
        status__in=[CheckInStatus.OK, CheckInStatus.ERROR],
    ).exists()


def update_monitor_environment(
    monitor_env: MonitorEnvironment,
    last_checkin: datetime | None,
    expected_ts: datetime,
    monitor_status: int | None = None,
):
    # Compute the next check-in time from our reference time
    next_checkin = monitor_env.monitor.get_next_expected_checkin(expected_ts)
    next_checkin_latest = monitor_env.monitor.get_next_expected_checkin_latest(expected_ts)

    monitor_env.last_checkin = last_checkin
    monitor_env.next_checkin = next_checkin
    monitor_env.next_checkin_latest = next_checkin_latest
    if monitor_status is not None:
        monitor_env.status = monitor_status

    monitor_env.save(
        update_fields=["last_checkin", "next_checkin", "next_checkin_latest", "status"]
    )
