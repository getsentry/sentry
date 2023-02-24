import logging
from typing import Mapping

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
    params = json.loads(message.payload.value)
    current_datetime = to_datetime(params["date_updated"])

    # TODO: Same as MonitorCheckInDetailsEndpoint.put. Keep in sync or factor out.
    with transaction.atomic():
        try:
            checkin = MonitorCheckIn.objects.select_related("monitor").get(
                monitor_id=params["monitor_id"], guid=params["checkin_id"]
            )
        except MonitorCheckIn.DoesNotExist:
            logger.debug("checkin does not exist: %s", params["checkin_id"])
            return

        monitor = checkin.monitor
        checkin.update(**params)

        if checkin.status == CheckInStatus.ERROR:
            monitor.mark_failed(current_datetime)
            return

        monitor_params = {
            "last_checkin": current_datetime,
            "next_checkin": monitor.get_next_scheduled_checkin(current_datetime),
        }

        if checkin.status == CheckInStatus.OK:
            monitor_params["status"] = MonitorStatus.OK

        Monitor.objects.filter(id=monitor.id).exclude(last_checkin__gt=current_datetime).update(
            **monitor_params
        )


class StoreCronCheckinStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return RunTask(
            function=process_message,
            next_step=CommitOffsets(commit),
        )
