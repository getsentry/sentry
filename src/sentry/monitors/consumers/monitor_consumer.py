import datetime
import logging
import uuid
from typing import Dict, Mapping, Optional

import msgpack
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import Commit, Message, Partition
from django.conf import settings
from django.db import transaction

from sentry import ratelimits
from sentry.constants import ObjectStatus
from sentry.db.models import BoundedPositiveIntegerField
from sentry.models import Project
from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorEnvironmentLimitsExceeded,
    MonitorLimitsExceeded,
    MonitorType,
)
from sentry.monitors.utils import signal_first_checkin, signal_first_monitor_created
from sentry.monitors.validators import ConfigValidator
from sentry.utils import json, metrics
from sentry.utils.dates import to_datetime
from sentry.utils.locking import UnableToAcquireLock
from sentry.utils.locking.manager import LockManager
from sentry.utils.services import build_instance_from_options

locks = LockManager(build_instance_from_options(settings.SENTRY_POST_PROCESS_LOCKS_BACKEND_OPTIONS))

logger = logging.getLogger(__name__)

CHECKIN_QUOTA_LIMIT = 5
CHECKIN_QUOTA_WINDOW = 60


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
                "status": ObjectStatus.ACTIVE,
                "type": MonitorType.CRON_JOB,
                "config": validated_config,
            },
        )
        signal_first_monitor_created(project, None, True)

    # Update existing monitor
    if monitor and not created and monitor.config != validated_config:
        monitor.update_config(config, validated_config)

    return monitor


# TODO(rjo100): Move check-in logic through the validator
def valid_duration(duration: Optional[int]) -> bool:
    if duration and (duration < 0 or duration > BoundedPositiveIntegerField.MAX_VALUE):
        return False

    return True


def _process_message(wrapper: Dict) -> None:
    # TODO: validate payload schema
    params = json.loads(wrapper["payload"])
    start_time = to_datetime(float(wrapper["start_time"]))
    project_id = int(wrapper["project_id"])
    source_sdk = wrapper["sdk"]

    environment = params.get("environment")
    project = Project.objects.get_from_cache(id=project_id)

    ratelimit_key = f"{params['monitor_slug']}:{environment}"

    metric_kwargs = {
        "source": "consumer",
        "source_sdk": source_sdk,
    }

    if ratelimits.is_limited(
        f"monitor-checkins:{ratelimit_key}",
        limit=CHECKIN_QUOTA_LIMIT,
        window=CHECKIN_QUOTA_WINDOW,
    ):
        metrics.incr(
            "monitors.checkin.dropped.ratelimited",
            tags={**metric_kwargs},
        )
        logger.debug("monitor check in rate limited: %s", params["monitor_slug"])
        return

    def update_existing_check_in(
        existing_check_in: MonitorCheckIn, updated_status: CheckInStatus, updated_duration: float
    ):
        if (
            existing_check_in.project_id != project_id
            or existing_check_in.monitor_id != monitor.id
            or existing_check_in.monitor_environment_id != monitor_environment.id
        ):
            metrics.incr(
                "monitors.checkin.result",
                tags={"source": "consumer", "status": "guid_mismatch"},
            )
            logger.debug(
                "check-in guid %s already associated with %s not payload %s",
                existing_check_in,
                existing_check_in.monitor_id,
                monitor.id,
            )
            return

        if existing_check_in.status in CheckInStatus.FINISHED_VALUES:
            metrics.incr(
                "monitors.checkin.result",
                tags={**metric_kwargs, "status": "checkin_finished"},
            )
            logger.debug(
                "check-in was finished: attempted update from %s to %s",
                existing_check_in.status,
                updated_status,
            )
            return

        if updated_duration is None:
            updated_duration = int(
                (start_time - existing_check_in.date_added).total_seconds() * 1000
            )

        if not valid_duration(updated_duration):
            metrics.incr(
                "monitors.checkin.result",
                tags={**metric_kwargs, "status": "failed_duration_check"},
            )
            logger.debug("check-in duration is invalid: %s", project.organization_id)
            return

        existing_check_in.update(status=updated_status, duration=updated_duration)

        return

    try:
        with transaction.atomic():
            monitor_config = params.get("monitor_config")
            try:
                monitor = _ensure_monitor_with_config(
                    project, params["monitor_slug"], monitor_config
                )

                if not monitor:
                    metrics.incr(
                        "monitors.checkin.result",
                        tags={**metric_kwargs, "status": "failed_validation"},
                    )
                    logger.info("monitor.validation.failed", extra={**params})
                    return
            except MonitorLimitsExceeded:
                metrics.incr(
                    "monitors.checkin.result",
                    tags={**metric_kwargs, "status": "failed_monitor_limits"},
                )
                logger.debug("monitor exceeds limits for organization: %s", project.organization_id)
                return

            try:
                monitor_environment = MonitorEnvironment.objects.ensure_environment(
                    project, monitor, environment
                )
            except MonitorEnvironmentLimitsExceeded:
                metrics.incr(
                    "monitors.checkin.result",
                    tags={**metric_kwargs, "status": "failed_monitor_environment_limits"},
                )
                logger.debug(
                    "monitor environment exceeds limits for monitor: %s", params["monitor_slug"]
                )
                return

            status = getattr(CheckInStatus, params["status"].upper())
            duration = (
                # Duration is specified in seconds from the client, it is
                # stored in the checkin model as milliseconds
                int(params["duration"] * 1000)
                if params.get("duration") is not None
                else None
            )

            # Invalid UUIDs will raise ValueError
            check_in_id = uuid.UUID(params["check_in_id"])

            # When the UUID is empty we will default to looking for the most
            # recent check-in which is not in a terminal state.
            use_latest_checkin = check_in_id.int == 0

            try:
                if use_latest_checkin:
                    check_in = (
                        MonitorCheckIn.objects.select_for_update()
                        .exclude(status__in=CheckInStatus.FINISHED_VALUES)
                        .order_by("-date_added")[:1]
                        .get()
                    )
                else:
                    check_in = MonitorCheckIn.objects.select_for_update().get(
                        guid=check_in_id,
                    )

                update_existing_check_in(check_in, status, duration)

            except MonitorCheckIn.DoesNotExist:
                # Infer the original start time of the check-in from the duration.
                # Note that the clock of this worker may be off from what Relay is reporting.
                date_added = start_time
                if duration is not None:
                    date_added -= datetime.timedelta(milliseconds=duration)

                if not valid_duration(duration):
                    metrics.incr(
                        "monitors.checkin.result",
                        tags={**metric_kwargs, "status": "failed_duration_check"},
                    )
                    logger.debug("check-in duration is invalid: %s", project.organization_id)
                    return

                expected_time = None
                if monitor_environment.last_checkin:
                    expected_time = monitor.get_next_scheduled_checkin_without_margin(
                        monitor_environment.last_checkin
                    )

                # If the UUID is unset (zero value) generate a new UUID
                if check_in_id.int == 0:
                    guid = uuid.uuid4()
                else:
                    guid = check_in_id

                lock = locks.get(f"checkin-creation:{guid}", duration=2, name="checkin_creation")
                try:
                    with lock.acquire():
                        check_in, created = MonitorCheckIn.objects.get_or_create(
                            defaults={
                                "duration": duration,
                                "status": status,
                                "date_added": date_added,
                                "date_updated": start_time,
                                "expected_time": expected_time,
                                "monitor_config": monitor.get_validated_config(),
                            },
                            project_id=project_id,
                            monitor=monitor,
                            monitor_environment=monitor_environment,
                            guid=guid,
                        )
                        if not created:
                            update_existing_check_in(check_in, status, duration)
                        else:
                            signal_first_checkin(project, monitor)

                except UnableToAcquireLock:
                    metrics.incr(
                        "monitors.checkin.result",
                        tags={**metric_kwargs, "status": "failed_checkin_creation_lock"},
                    )
                    logger.debug("failed to acquire lock to create check-in: %s", guid)
                    return

            if check_in.status == CheckInStatus.ERROR:
                monitor_environment.mark_failed(start_time)
            else:
                monitor_environment.mark_ok(check_in, start_time)

            metrics.incr(
                "monitors.checkin.result",
                tags={**metric_kwargs, "status": "complete"},
            )
    except Exception:
        # Skip this message and continue processing in the consumer.
        metrics.incr(
            "monitors.checkin.result",
            tags={**metric_kwargs, "status": "error"},
        )
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
