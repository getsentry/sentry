from collections.abc import Sequence
from datetime import datetime
from typing import Literal, TypedDict

from sentry_kafka_schemas.schema_types.ingest_monitors_v1 import CheckIn

from sentry.monitors.processing_errors.errors import (
    CheckinProcessingError,
    ProcessingError,
    ProcessingErrorType,
)
from sentry.monitors.types import CheckinContexts, CheckinItem, CheckinPayload


class CheckInOverrides(TypedDict, total=False):
    message_type: Literal["check_in"]
    payload: bytes
    start_time: int | float
    project_id: int
    sdk: str | None
    retention_days: int


class CheckinPayloadOverrides(TypedDict, total=False):
    check_in_id: str
    monitor_slug: str
    status: str
    environment: str
    duration: int
    monitor_config: dict[str, object]
    contexts: CheckinContexts


def build_checkin_item(
    ts: datetime | None = None,
    partition: int = 0,
    message_overrides: CheckInOverrides | None = None,
    payload_overrides: CheckinPayloadOverrides | None = None,
) -> CheckinItem:
    if ts is None:
        ts = datetime.now()

    message: CheckIn = {
        "message_type": "check_in",
        "payload": b"{}",
        "start_time": ts.timestamp(),
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
    processing_errors: Sequence[ProcessingError] | None = None,
    ts: datetime | None = None,
    partition: int = 0,
    message_overrides: CheckInOverrides | None = None,
    payload_overrides: CheckinPayloadOverrides | None = None,
) -> CheckinProcessingError:
    if processing_errors is None:
        processing_errors = [
            {
                "type": ProcessingErrorType.CHECKIN_ENVIRONMENT_MISMATCH,
                "existingEnvironment": "some-env",
            },
        ]
    return CheckinProcessingError(
        processing_errors,
        build_checkin_item(
            ts=ts,
            partition=partition,
            message_overrides=message_overrides,
            payload_overrides=payload_overrides,
        ),
    )
