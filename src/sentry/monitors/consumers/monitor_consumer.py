from __future__ import annotations

import logging
import uuid
from collections import defaultdict
from collections.abc import Mapping
from concurrent.futures import ThreadPoolExecutor, wait
from copy import deepcopy
from datetime import UTC, datetime, timedelta
from functools import partial
from typing import Any, Literal, NotRequired, TypedDict

import sentry_sdk
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.batching import BatchStep, ValuesBatch
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import BrokerValue, Commit, FilteredPayload, Message, Partition
from django.db import router, transaction
from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.ingest_monitors_v1 import IngestMonitorMessage
from sentry_sdk.tracing import Span, Transaction

from sentry import quotas, ratelimits
from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.constants import DataCategory, ObjectStatus
from sentry.db.postgres.transactions import in_test_hide_transaction_boundary
from sentry.killswitches import killswitch_matches_context
from sentry.models.project import Project
from sentry.monitors.clock_dispatch import try_monitor_clock_tick
from sentry.monitors.constants import PermitCheckInStatus
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
from sentry.monitors.processing_errors.errors import (
    CheckinEnvironmentMismatch,
    CheckinFinished,
    CheckinGuidProjectMismatch,
    CheckinInvalidDuration,
    CheckinInvalidGuid,
    CheckinValidationFailed,
    MonitorDisabled,
    MonitorDisabledNoQuota,
    MonitorEnviromentRateLimited,
    MonitorEnvironmentLimitExceeded,
    MonitorInvalidConfig,
    MonitorInvalidEnvironment,
    MonitorLimitExceeded,
    MonitorNotFound,
    MonitorOverQuota,
    OrganizationKillswitchEnabled,
    ProcessingError,
    ProcessingErrorsException,
    ProcessingErrorType,
)
from sentry.monitors.processing_errors.manager import handle_processing_errors
from sentry.monitors.system_incidents import update_check_in_volume
from sentry.monitors.types import CheckinItem
from sentry.monitors.utils import (
    get_new_timeout_at,
    get_timeout_at,
    signal_first_checkin,
    signal_monitor_created,
    valid_duration,
)
from sentry.monitors.validators import ConfigValidator, MonitorCheckInValidator
from sentry.types.actor import parse_and_validate_actor
from sentry.utils import json, metrics
from sentry.utils.dates import to_datetime
from sentry.utils.outcomes import Outcome, track_outcome

logger = logging.getLogger(__name__)

MONITOR_CODEC: Codec[IngestMonitorMessage] = get_topic_codec(Topic.INGEST_MONITORS)

CHECKIN_QUOTA_LIMIT = 6
CHECKIN_QUOTA_WINDOW = 60


def _ensure_monitor_with_config(
    project: Project,
    monitor_slug: str,
    config: dict[str, Any] | None,
) -> Monitor | None:
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

    # The upsert payload doesn't quite match the api one. Pop out the owner here since
    # it's not part of the monitor config
    owner = config.pop("owner", None)
    owner_user_id = None
    owner_team_id = None
    try:
        owner_actor = parse_and_validate_actor(owner, project.organization_id)
    except Exception:
        logger.exception(
            "Error attempting to resolve owner",
            extra={
                "slug": monitor_slug,
                "owner": owner,
            },
        )
    else:
        if owner_actor and owner_actor.is_user:
            owner_user_id = owner_actor.id
        elif owner_actor and owner_actor.is_team:
            owner_team_id = owner_actor.id

    validator = ConfigValidator(data=config)

    if not validator.is_valid():
        extra = {
            "slug": monitor_slug,
            "config": config,
            "errors": validator.errors,
        }
        logger.info("monitors.consumer.invalid_config", extra=extra)
        if not monitor:
            error: MonitorInvalidConfig = {
                "type": ProcessingErrorType.MONITOR_INVALID_CONFIG,
                "errors": validator.errors,
            }
            raise ProcessingErrorsException([error])
        return monitor

    validated_config = validator.validated_data
    created = False

    # Create monitor
    if not monitor:
        monitor, created = Monitor.objects.update_or_create(
            organization_id=project.organization_id,
            project_id=project.id,
            slug=monitor_slug,
            defaults={
                "name": monitor_slug,
                "status": ObjectStatus.ACTIVE,
                "type": MonitorType.CRON_JOB,
                "config": validated_config,
                "owner_user_id": owner_user_id,
                "owner_team_id": owner_team_id,
            },
        )
        if created:
            signal_monitor_created(project, None, True, monitor, None)

    # Update existing monitor
    if monitor and not created:
        if monitor.config != validated_config:
            monitor.update_config(config, validated_config)
        if (owner_user_id or owner_team_id) and (
            owner_user_id != monitor.owner_user_id or owner_team_id != monitor.owner_team_id
        ):
            monitor.update(owner_user_id=owner_user_id, owner_team_id=owner_team_id)

    return monitor


def check_killswitch(
    metric_kwargs: dict[str, str],
    project: Project,
) -> bool:
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


def check_ratelimit(metric_kwargs: dict[str, str], item: CheckinItem) -> bool:
    """
    Enforce check-in rate limits. Returns True if rate limit is enforced.
    """
    # Use the kafka message timestamp as part of the key to ensure we do not
    # rate-limit during backlog processing.
    ts = item.ts.replace(second=0, microsecond=0)

    ratelimit_key = f"{item.processing_key}:{ts}"

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


class _CheckinUpdateKwargs(TypedDict):
    status: NotRequired[CheckInStatus]
    duration: int | None
    timeout_at: NotRequired[datetime | None]
    date_updated: NotRequired[datetime]


def transform_checkin_uuid(
    txn: Transaction | Span,
    metric_kwargs: dict[str, str],
    monitor_slug: str,
    check_in_id: str,
) -> tuple[uuid.UUID, bool] | tuple[None, Literal[False]]:
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
    metric_kwargs: dict[str, str],
    project_id: int,
    monitor_environment: MonitorEnvironment,
    start_time: datetime,
    existing_check_in: MonitorCheckIn,
    updated_status: CheckInStatus,
    updated_duration: int | None,
) -> None:
    monitor = monitor_environment.monitor
    processing_errors: list[ProcessingError] = []

    if (
        existing_check_in.project_id != project_id
        or existing_check_in.monitor_id != monitor.id
        or existing_check_in.monitor_environment_id != monitor_environment.id
    ):
        mismatch_error: CheckinGuidProjectMismatch = {
            "type": ProcessingErrorType.CHECKIN_GUID_PROJECT_MISMATCH,
            "guid": existing_check_in.guid.hex,
        }
        processing_errors.append(mismatch_error)

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

    # Check-in has already reached a user terminal status sent by a previous
    # closing check-in.
    already_user_complete = existing_check_in.status in CheckInStatus.USER_TERMINAL_VALUES

    # This check allows timeout check-ins to be updated by a
    # user complete check-in. See the later logic for how existing TIMEOUT
    # check-ins are handled.
    updated_duration_only = (
        existing_check_in.status == CheckInStatus.TIMEOUT
        and updated_status in CheckInStatus.USER_TERMINAL_VALUES
    )

    if already_user_complete and not updated_duration_only:
        # If we receive an in-progress check-in after a user-terminal value it
        # could likely be due to the user's job running very quickly and events
        # coming in slightly out of order. We can just ignore this type of
        # error, and also return to not update the duration
        if updated_status == CheckInStatus.IN_PROGRESS:
            return

        finished_error: CheckinFinished = {
            "type": ProcessingErrorType.CHECKIN_FINISHED,
        }
        processing_errors.append(finished_error)

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

    if updated_duration is None:
        # We use abs here because in some cases we might end up having checkins arrive
        # slightly out of order due to race conditions in relay. In cases like this,
        # we're happy to just assume that the duration is the absolute difference between
        # the two dates.
        updated_duration = abs(
            int((start_time - existing_check_in.date_added).total_seconds() * 1000)
        )

    if not valid_duration(updated_duration):
        duration_error: CheckinInvalidDuration = {
            "type": ProcessingErrorType.CHECKIN_INVALID_DURATION,
            "duration": str(updated_duration),
        }
        processing_errors.append(duration_error)
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

    if processing_errors:
        raise ProcessingErrorsException(processing_errors, monitor=monitor)

    updated_checkin: _CheckinUpdateKwargs = {
        "status": updated_status,
        "duration": updated_duration,
    }

    # XXX(epurkhiser): We currently allow a existing timed-out check-in to
    # have it's duration updated. This helps users understand that a check-in
    # DID complete. However we will NOT currently transition the status away
    # from TIMEOUT.
    #
    # In the future we will likely revisit this by adding as `substatus` to
    # check-ins which can help in the scenario where a TIMEOUT check-in
    # transitions to a USER_TERMINAL_VALUES late value.
    if updated_duration_only:
        del updated_checkin["status"]

    # IN_PROGRESS heartbeats bump the timeout
    updated_checkin["timeout_at"] = get_new_timeout_at(
        existing_check_in,
        updated_status,
        start_time,
    )
    metrics.incr(
        "monitors.checkin.result",
        tags={**metric_kwargs, "status": "updated_existing_checkin"},
    )

    # IN_PROGRESS heartbeats bump the date_updated
    if updated_status == CheckInStatus.IN_PROGRESS:
        updated_checkin["date_updated"] = start_time

    existing_check_in.update(**updated_checkin)


def _process_checkin(item: CheckinItem, txn: Transaction | Span) -> None:
    params = item.payload

    # XXX: The start_time is when relay recieved the original envelope store
    # request sent by the SDK.
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
        killswitch_error: OrganizationKillswitchEnabled = {
            "type": ProcessingErrorType.ORGANIZATION_KILLSWITCH_ENABLED,
        }
        raise ProcessingErrorsException([killswitch_error])

    if check_ratelimit(metric_kwargs, item):
        track_outcome(
            org_id=project.organization_id,
            project_id=project.id,
            key_id=None,
            outcome=Outcome.RATE_LIMITED,
            reason="rate_limited",
            timestamp=start_time,
            category=DataCategory.MONITOR,
        )
        ratelimit_error: MonitorEnviromentRateLimited = {
            "type": ProcessingErrorType.MONITOR_ENVIRONMENT_RATELIMITED,
        }
        raise ProcessingErrorsException([ratelimit_error])

    # Does quotas allow for this check-in to be accepted?
    quotas_outcome: PermitCheckInStatus = quotas.backend.check_accept_monitor_checkin(
        project.id, monitor_slug
    )

    if quotas_outcome == PermitCheckInStatus.DROP:
        track_outcome(
            org_id=project.organization_id,
            project_id=project.id,
            key_id=None,
            outcome=Outcome.RATE_LIMITED,
            reason="over_quota",
            timestamp=start_time,
            category=DataCategory.MONITOR,
        )
        overquota_error: MonitorOverQuota = {
            "type": ProcessingErrorType.MONITOR_OVER_QUOTA,
        }
        raise ProcessingErrorsException([overquota_error])

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
        guid_error: CheckinInvalidGuid = {
            "type": ProcessingErrorType.CHECKIN_INVALID_GUID,
        }
        raise ProcessingErrorsException([guid_error])

    monitor_config = params.pop("monitor_config", None)

    if params.get("duration") is not None:
        # Duration is specified in seconds from the client, it is
        # stored in the checkin model as milliseconds
        params["duration"] = int(params["duration"] * 1000)

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
        validation_error: CheckinValidationFailed = {
            "type": ProcessingErrorType.CHECKIN_VALIDATION_FAILED,
            "errors": validator.errors,
        }
        raise ProcessingErrorsException([validation_error])

    validated_params = validator.validated_data

    ensure_config_errors: list[ProcessingError] = []
    monitor = None
    # 01
    # Retrieve or upsert monitor for this check-in
    try:
        monitor = _ensure_monitor_with_config(
            project,
            monitor_slug,
            monitor_config,
        )
    except ProcessingErrorsException as e:
        ensure_config_errors = list(e.processing_errors)
    except MonitorLimitsExceeded as e:
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
        limit_error: MonitorLimitExceeded = {
            "type": ProcessingErrorType.MONITOR_LIMIT_EXCEEDED,
            "reason": str(e),
        }
        raise ProcessingErrorsException([limit_error])

    # When accepting for upsert attempt to assign a seat for the monitor,
    # otherwise the monitor is marked as disabled
    if monitor and quotas_outcome == PermitCheckInStatus.ACCEPTED_FOR_UPSERT:
        seat_outcome = quotas.backend.assign_monitor_seat(monitor)
        if seat_outcome != Outcome.ACCEPTED:
            monitor.update(status=ObjectStatus.DISABLED)

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
        monitor_missing_error: MonitorNotFound = {
            "type": ProcessingErrorType.MONITOR_NOT_FOUND,
        }
        ensure_config_errors.append(monitor_missing_error)
        raise ProcessingErrorsException(ensure_config_errors)

    # When a monitor was accepted for upsert but is disabled we were unable to
    # assign a seat. Discard the check-in in this case.
    if (
        quotas_outcome == PermitCheckInStatus.ACCEPTED_FOR_UPSERT
        and monitor.status == ObjectStatus.DISABLED
    ):
        track_outcome(
            org_id=project.organization_id,
            project_id=project.id,
            key_id=None,
            outcome=Outcome.RATE_LIMITED,
            reason="over_quota",
            timestamp=start_time,
            category=DataCategory.MONITOR,
        )
        quota_disabled_error: MonitorDisabledNoQuota = {
            "type": ProcessingErrorType.MONITOR_DISABLED_NO_QUOTA,
        }
        raise ProcessingErrorsException([quota_disabled_error], monitor)

    # Discard check-ins if the monitor is disabled
    #
    # Typically a disabled monitor will result in a PermitCheckInStatus.DROP
    # and we'll have dropped the check in earlier during processing. This check
    # is here for the on-premise version of Sentry where quotas always accepts
    # check-ins, even when the monitor is disabled.
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
        disabled_error: MonitorDisabled = {
            "type": ProcessingErrorType.MONITOR_DISABLED,
        }
        raise ProcessingErrorsException([disabled_error], monitor)

    # 02
    # Retrieve or upsert monitor environment for this check-in
    try:
        monitor_environment = MonitorEnvironment.objects.ensure_environment(
            project, monitor, environment
        )
    except MonitorEnvironmentLimitsExceeded as e:
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
        env_limit_error: MonitorEnvironmentLimitExceeded = {
            "type": ProcessingErrorType.MONITOR_ENVIRONMENT_LIMIT_EXCEEDED,
            "reason": str(e),
        }
        raise ProcessingErrorsException([env_limit_error], monitor)
    except MonitorEnvironmentValidationFailed as e:
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
        invalid_env_error: MonitorInvalidEnvironment = {
            "type": ProcessingErrorType.MONITOR_INVALID_ENVIRONMENT,
            "reason": str(e),
        }
        raise ProcessingErrorsException([invalid_env_error], monitor)

    # 03
    # Create or update check-in

    try:
        with transaction.atomic(router.db_for_write(Monitor)):
            status = getattr(CheckInStatus, validated_params["status"].upper())
            trace_id = validated_params.get("contexts", {}).get("trace", {}).get("trace_id")
            duration = validated_params.get("duration")

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

                        existing_env = check_in.monitor_environment.get_environment().name

                        env_mismatch_error: CheckinEnvironmentMismatch = {
                            "type": ProcessingErrorType.CHECKIN_ENVIRONMENT_MISMATCH,
                            "existingEnvironment": str(existing_env),
                        }
                        raise ProcessingErrorsException([env_mismatch_error], monitor)

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

                # The "date_clock" is recorded as the "clock time" of when the
                # check-in was processed. The clock time is derived from the
                # kafka item timestamps (which are monotonic, thus why they
                # drive our clock).
                #
                # XXX: They are NOT timezone aware date times, set the timezone
                # to UTC
                clock_time = item.ts.replace(tzinfo=UTC)

                check_in, created = MonitorCheckIn.objects.get_or_create(
                    defaults={
                        "duration": duration,
                        "status": status,
                        "date_added": date_added,
                        "date_clock": clock_time,
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
                    with in_test_hide_transaction_boundary():
                        signal_first_checkin(project, monitor)
                    metrics.incr(
                        "monitors.checkin.result",
                        tags={**metric_kwargs, "status": "created_new_checkin"},
                    )

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
                # Note: We use `start_time` for received here since it's the time that this
                # checkin was received by relay. Potentially, `ts` should be the client
                # timestamp. If we change that, leave `received` the same.
                mark_failed(check_in, failed_at=start_time, received=start_time)
            else:
                mark_ok(check_in, succeeded_at=start_time)

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
    except Exception as e:
        if isinstance(e, ProcessingErrorsException):
            raise
        # Skip this message and continue processing in the consumer.
        metrics.incr(
            "monitors.checkin.result",
            tags={**metric_kwargs, "status": "error"},
        )
        txn.set_tag("result", "error")
        logger.exception("Failed to process check-in")


def process_checkin(item: CheckinItem) -> None:
    """
    Process an individual check-in
    """
    try:
        with sentry_sdk.start_transaction(
            op="_process_checkin",
            name="monitors.monitor_consumer",
        ) as txn:
            # Deepcopy the checkin here so that it's not modified. We need the original when we get a
            # `ProcessingErrorsException`
            _process_checkin(deepcopy(item), txn)
    except ProcessingErrorsException as e:
        handle_processing_errors(item, e)
    except Exception:
        logger.exception("Failed to process check-in")


def process_checkin_group(items: list[CheckinItem]) -> None:
    """
    Process a group of related check-ins (all part of the same monitor)
    completely serially.
    """
    for item in items:
        process_checkin(item)


def process_batch(
    executor: ThreadPoolExecutor, message: Message[ValuesBatch[KafkaPayload]]
) -> None:
    """
    Receives batches of check-in messages. This function will take the batch
    and group them together by monitor ID (ensuring order is preserved) and
    execute each group using a ThreadPoolWorker.

    By batching we're able to process check-ins in parallel while guaranteeing
    that no check-ins are processed out of order per monitor environment.
    """
    batch = message.payload

    latest_partition_ts: dict[int, datetime] = {}
    checkin_mapping: dict[str, list[CheckinItem]] = defaultdict(list)

    for item in batch:
        assert isinstance(item, BrokerValue)

        try:
            wrapper: IngestMonitorMessage = MONITOR_CODEC.decode(item.payload.value)
        except Exception:
            logger.exception("Failed to unpack message payload")
            continue

        latest_partition_ts[item.partition.index] = item.timestamp

        # Nothing needs to be done with a clock pulse, we will have already
        # stored the latest_partition_ts to be used to tick the clock at the
        # end of this batch if necessary
        if wrapper["message_type"] == "clock_pulse":
            continue

        checkin_item = CheckinItem(
            ts=item.timestamp,
            partition=item.partition.index,
            message=wrapper,
            payload=json.loads(wrapper["payload"]),
        )
        checkin_mapping[checkin_item.processing_key].append(checkin_item)

    # Number of check-ins that are being processed in this batch
    metrics.gauge("monitors.checkin.parallel_batch_count", len(batch))

    # Number of check-in groups we've collected to be processed in parallel
    metrics.gauge("monitors.checkin.parallel_batch_groups", len(checkin_mapping))

    # Submit check-in groups for processing
    with sentry_sdk.start_transaction(op="process_batch", name="monitors.monitor_consumer"):
        futures = [
            executor.submit(process_checkin_group, group) for group in checkin_mapping.values()
        ]
        wait(futures)

    # Update check in volume for the entire batch we've just processed
    update_check_in_volume(item.timestamp for item in batch if item.timestamp is not None)

    # Attempt to trigger monitor tasks across processed partitions
    for partition, ts in latest_partition_ts.items():
        try:
            try_monitor_clock_tick(ts, partition)
        except Exception:
            logger.exception("Failed to trigger monitor tasks")


def process_single(message: Message[KafkaPayload | FilteredPayload]) -> None:
    assert not isinstance(message.payload, FilteredPayload)
    assert isinstance(message.value, BrokerValue)

    try:
        wrapper: IngestMonitorMessage = MONITOR_CODEC.decode(message.payload.value)
        ts = message.value.timestamp
        partition = message.value.partition.index

        update_check_in_volume([ts])

        try:
            try_monitor_clock_tick(ts, partition)
        except Exception:
            logger.exception("Failed to trigger monitor tasks")

        # Nothing else to do with clock pulses
        if wrapper["message_type"] == "clock_pulse":
            return

        item = CheckinItem(
            ts=ts,
            partition=partition,
            message=wrapper,
            payload=json.loads(wrapper["payload"]),
        )
        process_checkin(item)
    except Exception:
        logger.exception("Failed to process message payload")


class StoreMonitorCheckInStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    parallel_executor: ThreadPoolExecutor | None = None

    batched_parallel = False
    """
    Does the consumer process unrelated check-ins in parallel?
    """

    max_batch_size = 500
    """
    How many messages will be batched at once when in parallel mode.
    """

    max_batch_time = 10
    """
    The maximum time in seconds to accumulate a bach of check-ins.
    """

    def __init__(
        self,
        mode: Literal["batched-parallel", "serial"] | None = None,
        max_batch_size: int | None = None,
        max_batch_time: int | None = None,
        max_workers: int | None = None,
    ) -> None:
        if mode == "batched-parallel":
            self.batched_parallel = True
            self.parallel_executor = ThreadPoolExecutor(max_workers=max_workers)

        if max_batch_size is not None:
            self.max_batch_size = max_batch_size
        if max_batch_time is not None:
            self.max_batch_time = max_batch_time

    def shutdown(self) -> None:
        if self.parallel_executor:
            self.parallel_executor.shutdown()

    def create_parallel_worker(self, commit: Commit) -> ProcessingStrategy[KafkaPayload]:
        assert self.parallel_executor is not None
        batch_processor = RunTask(
            function=partial(process_batch, self.parallel_executor),
            next_step=CommitOffsets(commit),
        )
        return BatchStep(
            max_batch_size=self.max_batch_size,
            max_batch_time=self.max_batch_time,
            next_step=batch_processor,
        )

    def create_synchronous_worker(self, commit: Commit) -> ProcessingStrategy[KafkaPayload]:
        return RunTask(
            function=process_single,
            next_step=CommitOffsets(commit),
        )

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        if self.batched_parallel:
            return self.create_parallel_worker(commit)
        else:
            return self.create_synchronous_worker(commit)
