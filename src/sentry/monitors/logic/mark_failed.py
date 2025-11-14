from __future__ import annotations
from typing import int

import logging
from datetime import datetime

from sentry.monitors.logic.incidents import try_incident_threshold
from sentry.monitors.models import MonitorCheckIn

logger = logging.getLogger(__name__)


def mark_failed(
    failed_checkin: MonitorCheckIn,
    failed_at: datetime,
    received: datetime | None = None,
    clock_tick: datetime | None = None,
) -> bool:
    # Use the failure time as recieved if there is no received time
    if received is None:
        received = failed_at

    return try_incident_threshold(failed_checkin, received, clock_tick)
