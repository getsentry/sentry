from __future__ import annotations

import functools
from collections.abc import Callable, Generator, Mapping
from contextlib import contextmanager
from enum import StrEnum
from typing import TypeVar

import sentry_sdk

from sentry.dynamic_sampling.per_org.tasks.gate import (
    is_killswitch_engaged,
    is_rollout_enabled,
    metrics_sample_rate,
)
from sentry.utils import metrics

F = TypeVar("F", bound=Callable[..., object])

METRIC_PREFIX = "dynamic_sampling"

SCHEDULER_BEAT_STATUS_METRIC = "dynamic_sampling.schedule_per_org_calculations.status"
SCHEDULER_BUCKET_STATUS_METRIC = "dynamic_sampling.schedule_per_org_calculations_bucket.status"
SCHEDULER_BUCKET_ORG_STATUS_METRIC = (
    "dynamic_sampling.schedule_per_org_calculations_bucket.org_status"
)


class TelemetryStatus(StrEnum):
    COMPLETED = "completed"
    DISPATCHED = "dispatched"
    FAILED = "failed"
    KILLSWITCHED = "killswitched"
    NO_SUBSCRIPTION = "no_subscription"
    NO_VOLUME = "no_volume"
    NOT_IN_ROLLOUT = "not_in_rollout"
    ORG_HAS_NO_DYNAMIC_SAMPLING = "org_has_no_dynamic_sampling"
    ORG_NOT_FOUND = "org_not_found"
    ROLLOUT_DISABLED = "rollout_disabled"
    ROLLOUT_EXCLUDED = "rollout_excluded"


class DynamicSamplingException(Exception):
    """This exception allows a task to bubble up the status to the caller, for the task decorator to emit a metric with a status that derives from the status recorded in the exception."""

    def __init__(self, status: TelemetryStatus) -> None:
        super().__init__(status.value)
        self.status = status


def emit_status(
    metric: str,
    status: TelemetryStatus,
    *,
    amount: int = 1,
    extra_tags: Mapping[str, str] | None = None,
) -> None:
    metrics.incr(
        metric,
        amount=amount,
        sample_rate=metrics_sample_rate(),
        tags={"status": status.value, **dict(extra_tags or {})},
    )


def emit_gauge(metric: str, value: float, *, tags: Mapping[str, str] | None = None) -> None:
    metrics.gauge(
        metric,
        value,
        sample_rate=metrics_sample_rate(),
        tags=dict(tags) if tags else None,
    )


def _get_status_from_result(result: object) -> TelemetryStatus:
    if isinstance(result, TelemetryStatus):
        return result
    return TelemetryStatus.COMPLETED


@contextmanager
def emit_duration(metric: str) -> Generator[Callable[[object], TelemetryStatus]]:
    with metrics.timer(metric, sample_rate=metrics_sample_rate()) as duration_tags:
        try:

            def set_status_from_result(result: object) -> TelemetryStatus:
                status = _get_status_from_result(result)
                duration_tags["status"] = status.value
                return status

            yield set_status_from_result
        except Exception:
            duration_tags["status"] = TelemetryStatus.FAILED.value
            raise


def track_dynamic_sampling(func: F) -> F:
    status_metric = f"{METRIC_PREFIX}.{func.__name__}.status"
    duration_metric = f"{METRIC_PREFIX}.{func.__name__}.duration"

    @functools.wraps(func)
    def wrapper(*args: object, **kwargs: object) -> object:
        result: object
        status: TelemetryStatus
        with emit_duration(duration_metric) as set_duration_status:
            try:
                if is_killswitch_engaged():
                    result = TelemetryStatus.KILLSWITCHED
                elif not is_rollout_enabled():
                    result = TelemetryStatus.ROLLOUT_DISABLED
                else:
                    result = func(*args, **kwargs)
            except DynamicSamplingException as exc:
                result = exc.status
            except Exception as exc:
                sentry_sdk.capture_exception(exc)
                emit_status(status_metric, TelemetryStatus.FAILED)
                raise

            status = set_duration_status(result)

        emit_status(status_metric, status)
        return result

    return wrapper  # type: ignore[return-value]
