import datetime
import logging
from typing import Dict, Mapping, Optional

import msgpack
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import Commit, Message, Partition
from django.db import transaction

from sentry.models import Project
from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorStatus,
    MonitorType,
)
from sentry.monitors.utils import signal_first_checkin
from sentry.monitors.validators import ConfigValidator
from sentry.utils import json
from sentry.utils.dates import to_datetime

logger = logging.getLogger(__name__)


def _ensure_monitor_with_config(
    project: Project,
    monitor_slug: str,
    config: Optional[Dict],
):
    try:
        monitor = Monitor.objects.get(
            slug=monitor_slug,
            project_id=project.id,
            organization_id=project.organization_id,
        )
    except Monitor.DoesNotExist:
        monitor = None

    if not config:
        return monitor

    validator = ConfigValidator(data=config)

    if not validator.is_valid():
        logger.debug("monitor_config for %s is not valid", monitor_slug)
        return monitor

    validated_config = validator.validated_data
    created = False

    # Create monitor
    if not monitor:
        monitor, created = Monitor.objects.update_or_create(
            organization_id=project.organization_id,
            slug=monitor_slug,
            defaults={
                "project_id": project.id,
                "name": monitor_slug,
                "status": MonitorStatus.ACTIVE,
                "type": MonitorType.CRON_JOB,
                "config": validated_config,
            },
        )

    # Update existing monitor
    if monitor and not created and monitor.config != validated_config:
        monitor.update(config=validated_config)

    return monitor


def _process_message(wrapper: Dict) -> None:
    # TODO: validate payload schema
    params = json.loads(wrapper["payload"])
    start_time = to_datetime(float(wrapper["start_time"]))
    project_id = int(wrapper["project_id"])

    project = Project.objects.get_from_cache(id=project_id)

    try:
        with transaction.atomic():
            monitor_config = params.get("monitor_config")
            monitor = _ensure_monitor_with_config(project, params["monitor_slug"], monitor_config)

            if not monitor:
                logger.debug("monitor does not exist: %s", params["monitor_slug"])
                return

            monitor_environment = MonitorEnvironment.objects.ensure_environment(
                project, monitor, params.get("environment")
            )

            status = getattr(CheckInStatus, params["status"].upper())
            duration = (
                # Duration is specified in seconds from the client, it is
                # stored in the checkin model as milliseconds
                int(params["duration"] * 1000)
                if params.get("duration") is not None
                else None
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
                    date_added -= datetime.timedelta(milliseconds=duration)

                check_in = MonitorCheckIn.objects.create(
                    project_id=project_id,
                    monitor=monitor,
                    monitor_environment=monitor_environment,
                    guid=params["check_in_id"],
                    duration=duration,
                    status=status,
                    date_added=date_added,
                    date_updated=start_time,
                )

                signal_first_checkin(project, monitor)

            if check_in.status == CheckInStatus.ERROR and monitor.status != MonitorStatus.DISABLED:
                monitor.mark_failed(start_time)
                monitor_environment.mark_failed(start_time)
            else:
                monitor.mark_ok(check_in, start_time)
                monitor_environment.mark_ok(check_in, start_time)
    except Exception:
        # Skip this message and continue processing in the consumer.
        logger.exception("Failed to process check-in", exc_info=True)


class StoreMonitorCheckInStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        def process_message(message: Message[KafkaPayload]) -> None:
            try:
                wrapper = msgpack.unpackb(message.payload.value)
                _process_message(wrapper)
            except Exception:
                logger.exception("Failed to process message payload")

        return RunTask(
            function=process_message,
            next_step=CommitOffsets(commit),
        )
