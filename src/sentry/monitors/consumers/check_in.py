import logging
from typing import Mapping

import msgpack
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import Commit, Message, Partition
from django.db import transaction

from sentry.models import CheckInStatus, Monitor, MonitorCheckIn, MonitorStatus
from sentry.utils import json
from sentry.utils.dates import to_datetime

logger = logging.getLogger(__name__)


def process_message(message: Message[KafkaPayload]) -> None:
    wrapper = msgpack.unpackb(message.payload.value)

    params = json.loads(wrapper["payload"])
    start_time = to_datetime(float(wrapper["start_time"]))
    project_id = int(wrapper["project_id"])

    # TODO: Same as MonitorCheckInDetailsEndpoint.put. Keep in sync or factor out.
    try:
        with transaction.atomic():
            try:
                check_in = MonitorCheckIn.objects.select_related("monitor").get(
                    project_id=project_id,
                    monitor__guid=params["monitor_id"],
                    guid=params["check_in_id"],
                )
            except MonitorCheckIn.DoesNotExist:
                logger.debug("check-in or monitor do not exist: %s", params["check_in_id"])
                return

            # Map attributes from raw JSON to the model.
            params["status"] = params["status"].upper()
            if "duration" in params:
                params["duration"] = int(params["duration"])
            else:
                params["duration"] = int((start_time - check_in.date_added).total_seconds() * 1000)

            monitor = check_in.monitor
            check_in.update(**params)

            if check_in.status == CheckInStatus.ERROR:
                monitor.mark_failed(start_time)
                return

            monitor_params = {
                "last_checkin": start_time,
                "next_checkin": monitor.get_next_scheduled_checkin(start_time),
            }

            if check_in.status == CheckInStatus.OK:
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
