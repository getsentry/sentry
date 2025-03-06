from __future__ import annotations

import logging
from datetime import datetime
from typing import NotRequired, TypedDict

from sentry.monitors.logic.incidents import try_incident_resolution
from sentry.monitors.models import MonitorCheckIn, MonitorEnvironment, MonitorStatus

logger = logging.getLogger(__name__)


class _Params(TypedDict):
    last_checkin: datetime
    next_checkin: datetime
    next_checkin_latest: datetime
    status: NotRequired[int]


def mark_ok(checkin: MonitorCheckIn, succeeded_at: datetime) -> None:
    """
    Given a successful check-in, attempt to resolve the active incident and
    mark the monitor as OK.

    The provided `succeeded_at` is the reference time for when the next check-in
    time is calculated from. This typically would be when the successful
    check-in was received.
    """
    monitor_env = checkin.monitor_environment

    next_checkin = monitor_env.monitor.get_next_expected_checkin(succeeded_at)
    next_checkin_latest = monitor_env.monitor.get_next_expected_checkin_latest(succeeded_at)

    params: _Params = {
        "last_checkin": checkin.date_added,
        "next_checkin": next_checkin,
        "next_checkin_latest": next_checkin_latest,
    }

    incident_resolved = try_incident_resolution(checkin)

    if incident_resolved:
        params["status"] = MonitorStatus.OK

    MonitorEnvironment.objects.filter(id=monitor_env.id).exclude(
        last_checkin__gt=succeeded_at
    ).update(**params)
