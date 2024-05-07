import zoneinfo
from datetime import UTC, datetime

from django.utils import timezone
from sentry_kafka_schemas.schema_types.ingest_monitors_v1 import CheckIn

from sentry.monitors.processing_errors import (
    CheckinProcessingError,
    ProcessingError,
    ProcessingErrorType,
)
from sentry.monitors.types import CheckinItem, CheckinPayload


def make_ref_time(**kwargs):
    """
    To accurately reflect the real usage of our check tasks, we want the ref
    time to be truncated down to a minute for our tests.
    """
    tz_name = kwargs.pop("timezone", "UTC")

    ts = timezone.now().replace(**kwargs, tzinfo=zoneinfo.ZoneInfo(tz_name))

    # Typically the task will not run exactly on the minute, but it will
    # run very close, let's say for our test that it runs 12 seconds after
    # the minute.
    #
    # This is testing that the task correctly clamps its reference time
    # down to the minute.
    #
    # Task timestamps are in UTC, convert our reference time to UTC for this
    task_run_ts = ts.astimezone(UTC).replace(second=12, microsecond=0)

    # Fan-out tasks recieve a floored version of the timestamp
    sub_task_run_ts = task_run_ts.replace(second=0)

    # We truncate down to the minute when we mark the next_checkin, do the
    # same here.
    trimmed_ts = ts.replace(second=0, microsecond=0)

    return task_run_ts, sub_task_run_ts, trimmed_ts


def build_checkin_item(ts=None, partition=0, message_overrides=None, payload_overrides=None):
    if ts is None:
        ts = datetime.now()

    message: CheckIn = {
        "message_type": "check_in",
        "payload": {},
        "start_time": ts,
        "project_id": 1,
        "sdk": None,
        "retention_days": 10,
    }
    if message_overrides:
        message.update(message_overrides)
    payload: CheckinPayload = {
        "check_in_id": "123",
        "monitor_slug": "hello",
        "status": "OK",
    }
    if payload_overrides:
        payload.update(payload_overrides)

    return CheckinItem(ts, partition, message, payload)


def build_checkin_processing_error(
    processing_errors: list[ProcessingError] | None = None, **checkin_item_params
):
    if processing_errors is None:
        processing_errors = [
            ProcessingError(ProcessingErrorType.MONITOR_DISABLED, {"some": "data"})
        ]
    return CheckinProcessingError(processing_errors, build_checkin_item(**checkin_item_params))
