"""Central metrics emitters for the per-org dynamic sampling pipeline.

Every metric emitted by the scheduler, the bucket fan-out, or the per-org
orchestrator goes through these helpers so that:

* the sample rate is read from a single option (``metrics_sample_rate``),
* the ``status`` tag convention is applied uniformly, and
* there is one place to change if the emission shape needs to evolve.
"""

from __future__ import annotations

import functools
from collections.abc import Callable, Generator, Mapping
from contextlib import contextmanager
from contextvars import ContextVar
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


def status_metric_for(func_name: str) -> str:
    return f"{METRIC_PREFIX}.{func_name}.status"


def duration_metric_for(func_name: str) -> str:
    return f"{METRIC_PREFIX}.{func_name}.duration"


def _merge_tags(status: str, extra: Mapping[str, str] | None) -> dict[str, str]:
    tags: dict[str, str] = {"status": status}
    if extra:
        tags.update(extra)
    return tags


def emit_status(
    metric: str,
    status: str,
    *,
    amount: int = 1,
    extra_tags: Mapping[str, str] | None = None,
) -> None:
    """Emit a counter with a ``status`` tag, sampled by the pipeline option."""
    metrics.incr(
        metric,
        amount=amount,
        sample_rate=metrics_sample_rate(),
        tags=_merge_tags(status, extra_tags),
    )


def emit_gauge(metric: str, value: float, *, tags: Mapping[str, str] | None = None) -> None:
    """Emit a gauge sampled by the pipeline option."""
    metrics.gauge(
        metric,
        value,
        sample_rate=metrics_sample_rate(),
        tags=dict(tags) if tags else None,
    )


@contextmanager
def timed(metric: str) -> Generator[None]:
    """Time a block with the pipeline's sample rate applied."""
    with metrics.timer(metric, sample_rate=metrics_sample_rate()):
        yield


F = TypeVar("F", bound=Callable[..., object])

_current_status_metric: ContextVar[str | None] = ContextVar(
    "dynamic_sampling_current_status_metric", default=None
)


def instrumented(func: F) -> F:
    """Automatically time a pipeline function and guard it with status telemetry.

    Derives metric names from the wrapped function:

    * ``dynamic_sampling.<func>.duration`` wraps every call in a timer.
    * ``dynamic_sampling.<func>.status`` receives ``status=failed`` with the
      exception captured to Sentry if the body raises. Successful terminal
      statuses (``completed``, ``killswitched``, early exits, ...) are
      emitted from inside the body via :func:`emit_status_metric`, which
      reads the same metric name, so callers never hardcode it.

    The exception is re-raised after the status metric fires so upstream
    retry / task-broker semantics are preserved.
    """

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
                    emit_status(status_metric, "failed")
                    raise
        finally:
            _current_status_metric.reset(token)

    return wrapper  # type: ignore[return-value]


def emit_status_metric(status: str, *, extra_tags: Mapping[str, str] | None = None) -> None:
    """Emit on the status metric of the enclosing decorated function.

    Must be called synchronously inside a function decorated with
    :func:`instrumented` (or a callee of one). Raises ``RuntimeError``
    otherwise, so misuse fails loudly during tests rather than silently
    dropping a metric.
    """

    metric = _current_status_metric.get()
    if metric is None:
        raise RuntimeError("emit_status_metric() called outside an @instrumented function")
    emit_status(metric, status, extra_tags=extra_tags)
