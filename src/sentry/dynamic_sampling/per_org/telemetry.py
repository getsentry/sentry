from __future__ import annotations

import functools
from collections.abc import Callable, Generator, Mapping
from contextlib import contextmanager
from enum import StrEnum
from typing import TypeVar

import sentry_sdk

from sentry.dynamic_sampling.per_org.gate import (
    is_killswitch_engaged,
    is_rollout_enabled,
    metrics_sample_rate,
)
from sentry.utils import metrics
from sentry.utils.snuba_rpc import SnubaRPCError, SnubaRPCTimeout

F = TypeVar("F", bound=Callable[..., object])

METRIC_PREFIX = "dynamic_sampling"

SCHEDULER_BUCKET_ORG_STATUS_METRIC = (
    "dynamic_sampling.schedule_per_org_calculations_bucket.org_status"
)

PROJECTS_BELOW_FULL_SAMPLE_RATE_METRIC = "dynamic_sampling.per_org.projects_below_full_sample_rate"


class DynamicSamplingStatus(StrEnum):
    ALL_PROJECTS_AT_FULL_SAMPLE_RATE = "all_projects_at_full_sample_rate"
    COMPLETED = "completed"
    DISPATCHED = "dispatched"
    FAILED = "failed"
    KILLSWITCHED = "killswitched"
    NO_SUBSCRIPTION = "no_subscription"
    NO_ORG_VOLUME = "no_org_volume"
    NO_PROJECT_VOLUMES = "no_project_volumes"
    NO_TRANSACTION_VOLUMES = "no_transaction_volumes"
    NOT_IN_ROLLOUT = "not_in_rollout"
    ORG_HAS_NO_DYNAMIC_SAMPLING = "org_has_no_dynamic_sampling"
    ORG_HAS_NO_PROJECTS = "org_has_no_projects"
    ORG_NOT_FOUND = "org_not_found"
    ROLLOUT_DISABLED = "rollout_disabled"
    ROLLOUT_EXCLUDED = "rollout_excluded"
    SNUBA_TIMEOUT = "snuba_timeout"
    SNUBA_ERROR = "snuba_error"


class DynamicSamplingException(Exception):
    """This exception allows a task to bubble up the status to the caller, for the task decorator to emit a metric with a status that derives from the status recorded in the exception."""

    def __init__(self, status: DynamicSamplingStatus) -> None:
        super().__init__(status.value)
        self.status = status


def emit_status(
    metric: str,
    status: DynamicSamplingStatus,
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


def emit_count(metric: str, amount: int) -> None:
    metrics.incr(
        metric,
        amount=amount,
        sample_rate=metrics_sample_rate(),
    )


def emit_gauge(metric: str, value: float, *, tags: Mapping[str, str] | None = None) -> None:
    metrics.gauge(
        metric,
        value,
        sample_rate=metrics_sample_rate(),
        tags=dict(tags) if tags else None,
    )


def _get_status_from_result(result: object) -> DynamicSamplingStatus:
    if isinstance(result, DynamicSamplingStatus):
        return result
    return DynamicSamplingStatus.COMPLETED


@contextmanager
def emit_duration(metric: str) -> Generator[Callable[[object], DynamicSamplingStatus]]:
    with metrics.timer(metric, sample_rate=metrics_sample_rate()) as duration_tags:
        try:

            def set_status_from_result(result: object) -> DynamicSamplingStatus:
                status = _get_status_from_result(result)
                duration_tags["status"] = status.value
                return status

            yield set_status_from_result
        except Exception:
            duration_tags["status"] = DynamicSamplingStatus.FAILED.value
            raise


def track_dynamic_sampling(func: F) -> F:
    status_metric = f"{METRIC_PREFIX}.{func.__name__}.status"
    duration_metric = f"{METRIC_PREFIX}.{func.__name__}.duration"

    @functools.wraps(func)
    def wrapper(*args: object, **kwargs: object) -> object:
        result: object
        status: DynamicSamplingStatus
        with emit_duration(duration_metric) as set_duration_status:
            try:
                if is_killswitch_engaged():
                    result = DynamicSamplingStatus.KILLSWITCHED
                elif not is_rollout_enabled():
                    result = DynamicSamplingStatus.ROLLOUT_DISABLED
                else:
                    result = func(*args, **kwargs)
            except DynamicSamplingException as exc:
                result = exc.status
            except SnubaRPCTimeout as exc:
                sentry_sdk.capture_exception(exc)
                emit_status(status_metric, DynamicSamplingStatus.SNUBA_TIMEOUT)
                raise
            except SnubaRPCError as exc:
                sentry_sdk.capture_exception(exc)
                emit_status(status_metric, DynamicSamplingStatus.SNUBA_ERROR)
                raise
            except Exception as exc:
                sentry_sdk.capture_exception(exc)
                emit_status(status_metric, DynamicSamplingStatus.FAILED)
                raise

            status = set_duration_status(result)

        emit_status(status_metric, status)
        return result

    return wrapper  # type: ignore[return-value]
