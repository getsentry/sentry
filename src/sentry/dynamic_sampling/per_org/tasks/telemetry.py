from __future__ import annotations

import functools
from collections.abc import Callable, Generator, Mapping
from contextlib import contextmanager
from contextvars import ContextVar
from enum import StrEnum
from typing import TypeVar

import sentry_sdk

from sentry.dynamic_sampling.per_org.tasks.gate import metrics_sample_rate
from sentry.utils import metrics

METRIC_PREFIX = "dynamic_sampling"

SCHEDULER_BEAT_STATUS_METRIC = "dynamic_sampling.schedule_per_org_calculations.status"
SCHEDULER_BUCKET_STATUS_METRIC = "dynamic_sampling.schedule_per_org_calculations_bucket.status"
SCHEDULER_BUCKET_ORG_STATUS_METRIC = (
    "dynamic_sampling.schedule_per_org_calculations_bucket.org_status"
)
SCHEDULER_BUCKET_SIZE_METRIC = "dynamic_sampling.schedule_per_org_calculations_bucket.bucket_size"


class TelemetryStatus(StrEnum):
    COMPLETED = "completed"
    DISPATCHED = "dispatched"
    FAILED = "failed"
    KILLSWITCHED = "killswitched"
    NO_VOLUME = "no_volume"
    NOT_IN_ROLLOUT = "not_in_rollout"
    ORG_HAS_NO_DYNAMIC_SAMPLING = "org_has_no_dynamic_sampling"
    ORG_NOT_FOUND = "org_not_found"
    ROLLOUT_DISABLED = "rollout_disabled"
    ROLLOUT_EXCLUDED = "rollout_excluded"


def status_metric_for(func_name: str) -> str:
    return f"{METRIC_PREFIX}.{func_name}.status"


def duration_metric_for(func_name: str) -> str:
    return f"{METRIC_PREFIX}.{func_name}.duration"


def _merge_tags(status: TelemetryStatus, extra: Mapping[str, str] | None) -> dict[str, str]:
    tags: dict[str, str] = {"status": status.value}
    if extra:
        tags.update(extra)
    return tags


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
        tags=_merge_tags(status, extra_tags),
    )


def emit_gauge(metric: str, value: float, *, tags: Mapping[str, str] | None = None) -> None:
    metrics.gauge(
        metric,
        value,
        sample_rate=metrics_sample_rate(),
        tags=dict(tags) if tags else None,
    )


@contextmanager
def timed(metric: str) -> Generator[None]:
    with metrics.timer(metric, sample_rate=metrics_sample_rate()):
        yield


F = TypeVar("F", bound=Callable[..., object])

_current_status_metric: ContextVar[str | None] = ContextVar(
    "dynamic_sampling_current_status_metric", default=None
)


def instrumented(func: F) -> F:
    status_metric = status_metric_for(func.__name__)
    duration_metric = duration_metric_for(func.__name__)

    @functools.wraps(func)
    def wrapper(*args: object, **kwargs: object) -> object:
        token = _current_status_metric.set(status_metric)
        try:
            with timed(duration_metric):
                try:
                    return func(*args, **kwargs)
                except Exception as exc:
                    sentry_sdk.capture_exception(exc)
                    emit_status(status_metric, TelemetryStatus.FAILED)
                    raise
        finally:
            _current_status_metric.reset(token)

    return wrapper  # type: ignore[return-value]


def emit_status_metric(
    status: TelemetryStatus, *, extra_tags: Mapping[str, str] | None = None
) -> None:
    metric = _current_status_metric.get()
    if metric is None:
        raise RuntimeError("emit_status_metric() called outside an @instrumented function")
    emit_status(metric, status, extra_tags=extra_tags)
