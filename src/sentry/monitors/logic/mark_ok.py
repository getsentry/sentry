from __future__ import annotations
from typing import int

import logging
from datetime import datetime

from sentry.monitors.logic.incidents import try_incident_resolution
from sentry.monitors.logic.monitor_environment import update_monitor_environment
from sentry.monitors.models import MonitorCheckIn, MonitorStatus

logger = logging.getLogger(__name__)


def mark_ok(checkin: MonitorCheckIn, succeeded_at: datetime) -> None:
    """
    Given a successful check-in, attempt to resolve the active incident and
    mark the monitor as OK.

    The provided `succeeded_at` is the reference time for when the next check-in
    time is calculated from. This typically would be when the successful
    check-in was received.
    """

    monitor_environment = checkin.monitor_environment

    incident_status: int | None = None
    if try_incident_resolution(checkin):
        incident_status = MonitorStatus.OK

    if monitor_environment.last_checkin is None or monitor_environment.last_checkin <= succeeded_at:
        update_monitor_environment(
            monitor_environment, checkin.date_added, succeeded_at, incident_status
        )
