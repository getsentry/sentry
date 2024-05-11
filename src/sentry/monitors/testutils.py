from datetime import datetime

from sentry_kafka_schemas.schema_types.ingest_monitors_v1 import CheckIn

from sentry.monitors.processing_errors import (
    CheckinProcessingError,
    MonitorDisabled,
    ProcessingErrorBase,
)
from sentry.monitors.types import CheckinItem, CheckinPayload


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
    processing_errors: list[ProcessingErrorBase] | None = None, **checkin_item_params
):
    if processing_errors is None:
        processing_errors = [MonitorDisabled()]
    return CheckinProcessingError(processing_errors, build_checkin_item(**checkin_item_params))
