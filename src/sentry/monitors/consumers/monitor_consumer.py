from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta
from typing import Dict, Mapping, Optional

import msgpack
import sentry_sdk
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import BrokerValue, Commit, Message, Partition
from django.db import router, transaction
from sentry_sdk.tracing import Span, Transaction

from sentry import ratelimits
from sentry.constants import DataCategory, ObjectStatus
from sentry.killswitches import killswitch_matches_context
from sentry.models.project import Project
from sentry.monitors.logic.mark_failed import mark_failed
from sentry.monitors.logic.mark_ok import mark_ok
from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorEnvironmentLimitsExceeded,
    MonitorEnvironmentValidationFailed,
    MonitorLimitsExceeded,
    MonitorType,
)
from sentry.monitors.tasks import try_monitor_tasks_trigger
from sentry.monitors.types import CheckinItem, CheckinMessage, ClockPulseMessage
from sentry.monitors.utils import (
    get_new_timeout_at,
    get_timeout_at,
    signal_first_checkin,
    signal_monitor_created,
    valid_duration,
)
from sentry.monitors.validators import ConfigValidator, MonitorCheckInValidator
from sentry.utils import json, metrics
from sentry.utils.dates import to_datetime
from sentry.utils.outcomes import Outcome, track_outcome

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
        extra = {
            "slug": monitor_slug,
            "config": config,
            "errors": validator.errors,
        }
        logger.info("monitors.consumer.invalid_config", extra=extra)
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
        if created:
            signal_monitor_created(project, None, True)
        # TODO(rjo100): Temporarily log to measure impact of a bug incorrectly scoping
        # the Monitor lookups to the wrapper's project_id. This means that any consumer check-in
        # will automatically get attached to a monitor with the given slug, regardless
        # of the monitor's attached project.
        if monitor and monitor.project_id != project.id:
            logger.error(
                "Monitor project + wrapper project do not match",
                extra={
                    "organization.id": project.organization_id,
                    "monitor.project_id": monitor.project_id,
                    "project.id": project.id,
                },
            )

    # Update existing monitor
    if monitor and not created and monitor.config != validated_config:
        monitor.update_config(config, validated_config)

    return monitor


def check_killswitch(
    metric_kwargs: Dict,
    project: Project,
):
    """
    Enforce organization level monitor kill switch. Returns true if the
    killswitch is enforced.
    """
    is_blocked = killswitch_matches_context(
        "crons.organization.disable-check-in", {"organization_id": project.organization_id}
    )
    if is_blocked:
        metrics.incr(
            "monitors.checkin.dropped.blocked",
            tags={**metric_kwargs},
        )
    return is_blocked


def check_ratelimit(
    metric_kwargs: Dict,
    project: Project,
    monitor_slug: str,
    environment: str | None,
):
    """
    Enforce check-in rate limits. Returns True if rate limit is enforced.
    """
    ratelimit_key = f"{project.organization_id}:{monitor_slug}:{environment}"

    is_blocked = ratelimits.backend.is_limited(
        f"monitor-checkins:{ratelimit_key}",
        limit=CHECKIN_QUOTA_LIMIT,
        window=CHECKIN_QUOTA_WINDOW,
    )

    if is_blocked:
        metrics.incr(
            "monitors.checkin.dropped.ratelimited",
            tags={**metric_kwargs},
        )
    return is_blocked


def transform_checkin_uuid(
    txn: Transaction | Span,
    metric_kwargs: Dict,
    monitor_slug: str,
    check_in_id: str,
):
    """
    Extracts the `UUID` object from the provided check_in_id. Failures will be logged.
    Returns the UUID object and a boolean indicating if the provided GUID
    signals usage of "the latest" check-in.
    When the provided GUID is `0` use_latest_checkin will be True, indicating
    that we should try and update the most recent check-in instead. A new UUID
    will still be returned for use in the scenario where there is no latest
    check-in.
    """
    check_in_guid: uuid.UUID | None = None

    try:
        check_in_guid = uuid.UUID(check_in_id)
    except ValueError:
        pass

    if check_in_guid is None:
        metrics.incr(
            "monitors.checkin.result",
            tags={**metric_kwargs, "status": "failed_guid_validation"},
        )
        txn.set_tag("result", "failed_guid_validation")
        logger.info(
            "monitors.consumer.guid_validation_failed",
            extra={"guid": check_in_id, "slug": monitor_slug},
        )
        return None, False

    # When the UUID is empty we will default to looking for the most
    # recent check-in which is not in a terminal state.
    use_latest_checkin = check_in_guid.int == 0

    # If the UUID is unset (zero value) generate a new UUID
    if use_latest_checkin:
        check_in_guid = uuid.uuid4()

    return check_in_guid, use_latest_checkin


def update_existing_check_in(
    txn: Transaction | Span,
    metric_kwargs: Dict,
    project_id: int,
    monitor_environment: MonitorEnvironment,
    start_time: datetime,
    existing_check_in: MonitorCheckIn,
    updated_status: CheckInStatus,
    updated_duration: float,
):
    monitor = monitor_environment.monitor

    if (
        existing_check_in.project_id != project_id
        or existing_check_in.monitor_id != monitor.id
        or existing_check_in.monitor_environment_id != monitor_environment.id
    ):
        metrics.incr(
            "monitors.checkin.result",
            tags={"source": "consumer", "status": "guid_mismatch"},
        )
        txn.set_tag("result", "guid_mismatch")
        logger.info(
            "monitors.consumer.guid_exists",
            extra={
                "guid": existing_check_in.guid.hex,
                "slug": existing_check_in.monitor.slug,
                "payload_slug": monitor.slug,
            },
        )
        return

    if existing_check_in.status in CheckInStatus.FINISHED_VALUES:
        metrics.incr(
            "monitors.checkin.result",
            tags={**metric_kwargs, "status": "checkin_finished"},
        )
        txn.set_tag("result", "checkin_finished")
        logger.info(
            "monitors.consumer.check_in_closed",
            extra={
                "guid": existing_check_in.guid.hex,
                "slug": existing_check_in.monitor.slug,
                "status": existing_check_in.status,
                "updated_status": updated_status,
            },
        )
        return

    if updated_duration is None:
        updated_duration = int((start_time - existing_check_in.date_added).total_seconds() * 1000)

    if not valid_duration(updated_duration):
        metrics.incr(
            "monitors.checkin.result",
            tags={**metric_kwargs, "status": "failed_duration_check"},
        )
        txn.set_tag("result", "failed_duration_check")
        logger.info(
            "monitors.consumer.invalid_implicit_duration",
            extra={
                "guid": existing_check_in.guid.hex,
                "slug": existing_check_in.monitor.slug,
                "duration": updated_duration,
            },
        )
        return

    # update date_added for heartbeat
    date_updated = existing_check_in.date_updated
    if updated_status == CheckInStatus.IN_PROGRESS:
        date_updated = start_time

    updated_timeout_at = get_new_timeout_at(existing_check_in, updated_status, start_time)

    existing_check_in.update(
        status=updated_status,
        duration=updated_duration,
        date_updated=date_updated,
        timeout_at=updated_timeout_at,
    )

    return


def _process_checkin(item: CheckinItem, txn: Transaction | Span):
    params = item.payload

    start_time = to_datetime(float(item.message["start_time"]))
    project_id = int(item.message["project_id"])
    source_sdk = item.message["sdk"]

    monitor_slug = item.valid_monitor_slug
    environment = params.get("environment")

    project = Project.objects.get_from_cache(id=project_id)

    # Strip sdk version to reduce metric cardinality
    sdk_platform = source_sdk.split("/")[0] if source_sdk else "none"

    metric_kwargs = {
        "source": "consumer",
        "sdk_platform": sdk_platform,
    }

    if check_killswitch(metric_kwargs, project):
        track_outcome(
            org_id=project.organization_id,
            project_id=project.id,
            key_id=None,
            outcome=Outcome.ABUSE,
            reason="killswitch",
            timestamp=start_time,
            category=DataCategory.MONITOR,
        )
        return

    if check_ratelimit(metric_kwargs, project, monitor_slug, environment):
        track_outcome(
            org_id=project.organization_id,
            project_id=project.id,
            key_id=None,
            outcome=Outcome.RATE_LIMITED,
            reason="rate_limited",
            timestamp=start_time,
            category=DataCategory.MONITOR,
        )
        return

    guid, use_latest_checkin = transform_checkin_uuid(
        txn,
        metric_kwargs,
        monitor_slug,
        params["check_in_id"],
    )

    if guid is None:
        track_outcome(
            org_id=project.organization_id,
            project_id=project.id,
            key_id=None,
            outcome=Outcome.INVALID,
            reason="invalid_guid",
            timestamp=start_time,
            category=DataCategory.MONITOR,
        )
        return

    monitor_config = params.pop("monitor_config", None)

    params["duration"] = (
        # Duration is specified in seconds from the client, it is
        # stored in the checkin model as milliseconds
        int(params["duration"] * 1000)
        if params.get("duration") is not None
        else None
    )

    validator = MonitorCheckInValidator(
        data=params,
        partial=True,
        context={
            "project": project,
        },
    )

    if not validator.is_valid():
        metrics.incr(
            "monitors.checkin.result",
            tags={**metric_kwargs, "status": "failed_checkin_validation"},
        )
        txn.set_tag("result", "failed_checkin_validation")
        logger.info(
            "monitors.consumer.checkin_validation_failed",
            extra={"guid": guid.hex, **params},
        )
        track_outcome(
            org_id=project.organization_id,
            project_id=project.id,
            key_id=None,
            outcome=Outcome.INVALID,
            reason="invalid_check_in",
            timestamp=start_time,
            category=DataCategory.MONITOR,
        )
        return

    validated_params = validator.validated_data

    # 01
    # Retrieve or upsert monitor for this check-in
    try:
        monitor = _ensure_monitor_with_config(
            project,
            monitor_slug,
            monitor_config,
        )
    except MonitorLimitsExceeded:
        metrics.incr(
            "monitors.checkin.result",
            tags={**metric_kwargs, "status": "failed_monitor_limits"},
        )
        txn.set_tag("result", "failed_monitor_limits")
        logger.info(
            "monitors.consumer.monitor_limit_exceeded",
            extra={"guid": guid.hex, "project": project.id, "slug": monitor_slug},
        )
        track_outcome(
            org_id=project.organization_id,
            project_id=project.id,
            key_id=None,
            outcome=Outcome.INVALID,
            reason="monitor_limit_exceeded",
            timestamp=start_time,
            category=DataCategory.MONITOR,
        )
        return

    if not monitor:
        metrics.incr(
            "monitors.checkin.result",
            tags={**metric_kwargs, "status": "failed_validation"},
        )
        txn.set_tag("result", "failed_validation")
        logger.info(
            "monitors.consumer.monitor_validation_failed",
            extra={"guid": guid.hex, "project": project.id, **params},
        )
        track_outcome(
            org_id=project.organization_id,
            project_id=project.id,
            key_id=None,
            outcome=Outcome.INVALID,
            reason="invalid_monitor",
            timestamp=start_time,
            category=DataCategory.MONITOR,
        )
        return

    # Discard check-ins if the monitor is disabled
    if monitor.status == ObjectStatus.DISABLED:
        metrics.incr(
            "monitors.checkin.result",
            tags={**metric_kwargs, "status": "monitor_disabled"},
        )
        txn.set_tag("result", "monitor_disabled")
        track_outcome(
            org_id=project.organization_id,
            project_id=project.id,
            key_id=None,
            outcome=Outcome.FILTERED,
            reason="monitor_disabled",
            timestamp=start_time,
            category=DataCategory.MONITOR,
        )
        return

    # 02
    # Retrieve or upsert monitor environment for this check-in
    try:
        monitor_environment = MonitorEnvironment.objects.ensure_environment(
            project, monitor, environment
        )
    except MonitorEnvironmentLimitsExceeded:
        metrics.incr(
            "monitors.checkin.result",
            tags={**metric_kwargs, "status": "failed_monitor_environment_limits"},
        )
        txn.set_tag("result", "failed_monitor_environment_limits")
        logger.info(
            "monitors.consumer.monitor_environment_limit_exceeded",
            extra={
                "guid": guid.hex,
                "project": project.id,
                "slug": monitor_slug,
                "environment": environment,
            },
        )
        track_outcome(
            org_id=project.organization_id,
            project_id=project.id,
            key_id=None,
            outcome=Outcome.INVALID,
            reason="monitor_environment_limit_exceeded",
            timestamp=start_time,
            category=DataCategory.MONITOR,
        )
        return
    except MonitorEnvironmentValidationFailed:
        metrics.incr(
            "monitors.checkin.result",
            tags={**metric_kwargs, "status": "failed_monitor_environment_name_length"},
        )
        txn.set_tag("result", "failed_monitor_environment_name_length")
        logger.info(
            "monitors.consumer.monitor_environment_validation_failed",
            extra={
                "guid": guid.hex,
                "project": project.id,
                "slug": monitor_slug,
                "environment": environment,
            },
        )
        track_outcome(
            org_id=project.organization_id,
            project_id=project.id,
            key_id=None,
            outcome=Outcome.INVALID,
            reason="invalid_monitor_environment",
            timestamp=start_time,
            category=DataCategory.MONITOR,
        )
        return

    # 03
    # Create or update check-in

    try:
        with transaction.atomic(router.db_for_write(Monitor)):
            status = getattr(CheckInStatus, validated_params["status"].upper())
            trace_id = validated_params.get("contexts", {}).get("trace", {}).get("trace_id")
            duration = validated_params["duration"]

            # 03-A
            # Retrieve existing check-in for update
            try:
                if use_latest_checkin:
                    check_in = (
                        MonitorCheckIn.objects.select_for_update()
                        .filter(
                            monitor_environment=monitor_environment,
                            status=CheckInStatus.IN_PROGRESS,
                        )
                        .order_by("-date_added")[:1]
                        .get()
                    )
                else:
                    check_in = MonitorCheckIn.objects.select_for_update().get(
                        guid=guid,
                    )

                    if check_in.monitor_environment_id != monitor_environment.id:
                        metrics.incr(
                            "monitors.checkin.result",
                            tags={
                                **metric_kwargs,
                                "status": "failed_monitor_environment_guid_match",
                            },
                        )
                        txn.set_tag("result", "failed_monitor_environment_guid_match")
                        logger.info(
                            "monitors.consumer.monitor_environment_mismatch",
                            extra={
                                "guid": guid.hex,
                                "slug": monitor_slug,
                                "organization_id": project.organization_id,
                                "environment": monitor_environment.id,
                                "payload_environment": check_in.monitor_environment_id,
                            },
                        )
                        track_outcome(
                            org_id=project.organization_id,
                            project_id=project.id,
                            key_id=None,
                            outcome=Outcome.INVALID,
                            reason="monitor_environment_mismatch",
                            timestamp=start_time,
                            category=DataCategory.MONITOR,
                        )
                        return

                txn.set_tag("outcome", "process_existing_checkin")
                update_existing_check_in(
                    txn,
                    metric_kwargs,
                    project_id,
                    monitor_environment,
                    start_time,
                    check_in,
                    status,
                    duration,
                )

            # 03-B
            # Create a brand new check-in object
            except MonitorCheckIn.DoesNotExist:
                # Infer the original start time of the check-in from the duration.
                # Note that the clock of this worker may be off from what Relay is reporting.
                date_added = start_time
                if duration is not None:
                    date_added -= timedelta(milliseconds=duration)

                # When was this check-in expected to have happened?
                expected_time = monitor_environment.next_checkin

                # denormalize the monitor configration into the check-in.
                # Useful to show details about the configuration of the
                # monitor at the time of the check-in
                monitor_config = monitor.get_validated_config()
                timeout_at = get_timeout_at(monitor_config, status, date_added)

                check_in, created = MonitorCheckIn.objects.get_or_create(
                    defaults={
                        "duration": duration,
                        "status": status,
                        "date_added": date_added,
                        "date_updated": start_time,
                        "expected_time": expected_time,
                        "timeout_at": timeout_at,
                        "monitor_config": monitor_config,
                        "trace_id": trace_id,
                    },
                    project_id=project_id,
                    monitor=monitor,
                    monitor_environment=monitor_environment,
                    guid=guid,
                )

                # Race condition. The check-in was created (such as an
                # in_progress) while this check-in was being processed.
                # Create a new one now.
                #
                # XXX(epurkhiser): Is this needed since we're already
                # locking this entire process?
                if not created:
                    txn.set_tag("outcome", "process_existing_checkin_race_condition")
                    update_existing_check_in(
                        txn,
                        metric_kwargs,
                        project_id,
                        monitor_environment,
                        start_time,
                        check_in,
                        status,
                        duration,
                    )
                else:
                    txn.set_tag("outcome", "create_new_checkin")
                    signal_first_checkin(project, monitor)

            track_outcome(
                org_id=project.organization_id,
                project_id=project.id,
                key_id=None,
                outcome=Outcome.ACCEPTED,
                reason=None,
                timestamp=start_time,
                category=DataCategory.MONITOR,
            )

            # 04
            # Update monitor status
            if check_in.status == CheckInStatus.ERROR:
                mark_failed(check_in, ts=start_time)
            else:
                mark_ok(check_in, ts=start_time)

            # track how much time it took for the message to make it through
            # relay into kafka. This should help us understand when missed
            # check-ins may be slipping in, since we use the `item.ts` to click
            # the clock forward, if that is delayed it's possible for the
            # check-in to come in late
            kafka_delay = item.ts - start_time.replace(tzinfo=None)
            metrics.gauge("monitors.checkin.relay_kafka_delay", kafka_delay.total_seconds())

            # how long in wall-clock time did it take for us to process this
            # check-in. This records from when the message was first appended
            # into the Kafka topic until we just completed processing.
            #
            # XXX: We are ONLY recording this metric for completed check-ins.
            delay = datetime.now() - item.ts
            metrics.gauge("monitors.checkin.completion_time", delay.total_seconds())

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
        txn.set_tag("result", "error")
        logger.exception("Failed to process check-in")


def _process_message(
    ts: datetime,
    partition: int,
    wrapper: CheckinMessage | ClockPulseMessage,
) -> None:
    try:
        try_monitor_tasks_trigger(ts, partition)
    except Exception:
        logger.exception("Failed to trigger monitor tasks")

    # Nothing else to do with clock pulses
    if wrapper["message_type"] == "clock_pulse":
        return

    with sentry_sdk.start_transaction(
        op="_process_message",
        name="monitors.monitor_consumer",
    ) as txn:
        item = CheckinItem(
            ts=ts,
            partition=partition,
            message=wrapper,
            payload=json.loads(wrapper["payload"]),
        )
        _process_checkin(item, txn)


class StoreMonitorCheckInStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        def process_message(message: Message[KafkaPayload]) -> None:
            assert isinstance(message.value, BrokerValue)
            try:
                wrapper = msgpack.unpackb(message.payload.value)
                _process_message(
                    message.value.timestamp,
                    message.value.partition.index,
                    wrapper,
                )
            except Exception:
                logger.exception("Failed to process message payload")

        return RunTask(
            function=process_message,
            next_step=CommitOffsets(commit),
        )
