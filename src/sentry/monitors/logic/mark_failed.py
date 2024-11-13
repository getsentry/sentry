from __future__ import annotations

import logging
from datetime import datetime

from django.db.models import Q

from sentry.monitors.logic.incidents import try_incident_threshold
from sentry.monitors.models import CheckInStatus, MonitorCheckIn, MonitorEnvironment

logger = logging.getLogger(__name__)


def mark_failed(
    failed_checkin: MonitorCheckIn,
    failed_at: datetime,
    received: datetime | None = None,
) -> bool:
    """
    Given a failing check-in, mark the monitor environment as failed and trigger
    side effects for creating monitor incidents and issues.

    The provided `failed_at` is the reference time for when the next check-in
    time is calculated from. This typically would be the failed check-in's
    `date_added` or completion time. Though for the missed and time-out tasks
    this may be computed based on the tasks reference time.
    """
    monitor_env = failed_checkin.monitor_environment

    if monitor_env is None:
        return False

    # Compute the next check-in time from our reference time
    next_checkin = monitor_env.monitor.get_next_expected_checkin(failed_at)
    next_checkin_latest = monitor_env.monitor.get_next_expected_checkin_latest(failed_at)

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
    return try_incident_threshold(failed_checkin, received)
