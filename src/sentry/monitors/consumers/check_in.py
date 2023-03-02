import datetime
import logging
from typing import Mapping

import msgpack
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import Commit, Message, Partition
from django.db import transaction

from sentry.models import CheckInStatus, Monitor, MonitorCheckIn, MonitorStatus, Project
from sentry.signals import first_cron_checkin_received, first_cron_monitor_created
from sentry.utils import json
from sentry.utils.dates import to_datetime

logger = logging.getLogger(__name__)


def process_message(message: Message[KafkaPayload]) -> None:
    wrapper = msgpack.unpackb(message.payload.value)

    params = json.loads(wrapper["payload"])
    start_time = to_datetime(float(wrapper["start_time"]))
    project_id = int(wrapper["project_id"])

    # TODO: Same as the check-in endpoints. Keep in sync or factor out.
    try:
        with transaction.atomic():
            try:
                monitor = Monitor.objects.select_for_update().get(
                    guid=params["monitor_id"], project_id=project_id
                )
            except Monitor.DoesNotExist:
                logger.debug("monitor does not exist: %s", params["monitor_id"])
                return

            status = getattr(CheckInStatus, params["status"].upper())
            duration = (
                int(params["duration"] * 1000) if params.get("duration") is not None else None
            )

            try:
                check_in = MonitorCheckIn.objects.select_for_update().get(
                    guid=params["check_in_id"],
                    project_id=project_id,
                    monitor=monitor,
                )

                if duration is None:
                    duration = int((start_time - check_in.date_added).total_seconds() * 1000)

                check_in.update(status=status, duration=duration)

            except MonitorCheckIn.DoesNotExist:
                # Infer the original start time of the check-in from the duration.
                # Note that the clock of this worker may be off from what Relay is reporting.
                date_added = start_time
                if duration is not None:
                    date_added -= datetime.timedelta(seconds=duration)

                check_in = MonitorCheckIn.objects.create(
                    project_id=project_id,
                    monitor=monitor,
                    guid=params["check_in_id"],
                    duration=duration,
                    status=status,
                    date_added=date_added,
                    date_updated=start_time,
                )

                project = Project.objects.get_from_cache(id=project_id)
                if not project.flags.has_cron_checkins:
                    # Backfill users that already have cron monitors
                    if not project.flags.has_cron_monitors:
                        first_cron_monitor_created.send_robust(
                            project=project, user=None, sender=Project
                        )

                    first_cron_checkin_received.send_robust(
                        project=project, monitor_id=str(monitor.guid), sender=Project
                    )

            if check_in.status == CheckInStatus.ERROR and monitor.status != MonitorStatus.DISABLED:
                monitor.mark_failed(start_time)
                return

            monitor_params = {
                "last_checkin": start_time,
                "next_checkin": monitor.get_next_scheduled_checkin(start_time),
            }

            if check_in.status == CheckInStatus.OK and monitor.status != MonitorStatus.DISABLED:
                monitor_params["status"] = MonitorStatus.OK

            Monitor.objects.filter(id=monitor.id).exclude(last_checkin__gt=start_time).update(
                **monitor_params
            )
    except Exception:
        # Skip this message and continue processing in the consumer.
        logger.exception("Failed to process check-in", exc_info=True)


class StoreMonitorCheckInStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return RunTask(
            function=process_message,
            next_step=CommitOffsets(commit),
        )
