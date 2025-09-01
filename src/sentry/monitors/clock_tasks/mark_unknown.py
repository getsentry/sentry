from __future__ import annotations

import logging
from datetime import datetime

from arroyo.backends.kafka import KafkaPayload
from sentry_kafka_schemas.schema_types.monitors_clock_tasks_v1 import MarkUnknown

from sentry.monitors.models import CheckInStatus, MonitorCheckIn
from sentry.utils import metrics

from .producer import MONITORS_CLOCK_TASKS_CODEC, produce_task

logger = logging.getLogger(__name__)

# This is the MAXIMUM number of pending MONITOR CHECKINS this job will check.
#
# NOTE: We should keep an eye on this as we have more and more usage of
# monitors the larger the number of checkins to check will exist.
CHECKINS_LIMIT = 10_000


def dispatch_mark_unknown(ts: datetime):
    """
    Given a clock tick timestamp datetime which was processed where an anomaly
    had been detected in the volume of check-ins that have been processed,
    determine monitors that are in-progress that can no longer be known to
    complete as data loss has likely occurred.

    This will dispatch MarkUnknown messages into monitors-clock-tasks.
    """
    unknown_checkins = list(
        MonitorCheckIn.objects.filter(
            status=CheckInStatus.IN_PROGRESS,
            date_added__lte=ts,
        )
        .values("id", "monitor_environment_id")
        .order_by("-date_added")[:CHECKINS_LIMIT]
    )

    metrics.gauge(
        "sentry.monitors.tasks.check_unknown.count",
        len(unknown_checkins),
        sample_rate=1.0,
    )

    # check for any monitors which were started before we processed an unknown
    # tick. We need to mark all in-progress as unnknown since we do not know if
    # the OK check-in may have been sent while we had data-loss and it will
    # time-out in the future after we've recovered.
    for checkin in unknown_checkins:
        message: MarkUnknown = {
            "type": "mark_unknown",
            "ts": ts.timestamp(),
            "monitor_environment_id": checkin["monitor_environment_id"],
            "checkin_id": checkin["id"],
        }
        payload = KafkaPayload(
            str(checkin["monitor_environment_id"]).encode(),
            MONITORS_CLOCK_TASKS_CODEC.encode(message),
            [],
        )
        produce_task(payload)


def mark_checkin_unknown(checkin_id: int, ts: datetime) -> None:
    logger.info("checkin_unknown", extra={"checkin_id": checkin_id})

    MonitorCheckIn.objects.filter(id=checkin_id, status=CheckInStatus.IN_PROGRESS).update(
        status=CheckInStatus.UNKNOWN,
    )
