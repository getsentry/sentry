from __future__ import annotations

import functools
import logging
import time
from collections.abc import Callable, Generator
from contextlib import contextmanager
from typing import TYPE_CHECKING, Any, TypeVar

import sentry_sdk
from django.conf import settings
from rest_framework.request import Request

from sentry.metrics.base import MetricsBackend, MutableTags, Tags
from sentry.metrics.middleware import MiddlewareWrapper, add_global_tags, global_tags

if TYPE_CHECKING:
    from sentry.models.organization import Organization

__all__ = [
    "add_global_tags",
    "global_tags",
    "incr",
    "timer",
    "timing",
    "gauge",
    "distribution",
    "set",
    "backend",
    "MutableTags",
    "ensure_crash_rate_in_bounds",
]


T = TypeVar("T")
F = TypeVar("F", bound=Callable[..., Any])


def get_default_backend() -> MetricsBackend:
    from sentry.utils.imports import import_string

    cls: type[MetricsBackend] = import_string(settings.SENTRY_METRICS_BACKEND)

    return MiddlewareWrapper(cls(**settings.SENTRY_METRICS_OPTIONS))


backend = get_default_backend()


def incr(
    key: str,
    amount: int = 1,
    instance: str | None = None,
    tags: Tags | None = None,
    skip_internal: bool = True,  # Ignored; kept for existing callers in sentry and getsentry.
    sample_rate: float = settings.SENTRY_METRICS_SAMPLE_RATE,
    unit: str | None = None,
    stacklevel: int = 0,
) -> None:
    try:
        backend.incr(key, instance, tags, amount, sample_rate, unit, stacklevel + 1)
    except Exception:
        logger = logging.getLogger("sentry.errors")
        logger.exception("Unable to record backend metric")


def gauge(
    key: str,
    value: float,
    instance: str | None = None,
    tags: Tags | None = None,
    sample_rate: float = settings.SENTRY_METRICS_SAMPLE_RATE,
    unit: str | None = None,
    stacklevel: int = 0,
) -> None:
    try:
        backend.gauge(key, value, instance, tags, sample_rate, unit, stacklevel + 1)
    except Exception:
        logger = logging.getLogger("sentry.errors")
        logger.exception("Unable to record backend metric")


def timing(
    key: str,
    value: int | float,
    instance: str | None = None,
    tags: Tags | None = None,
    sample_rate: float = settings.SENTRY_METRICS_SAMPLE_RATE,
    stacklevel: int = 0,
) -> None:
    try:
        backend.timing(key, value, instance, tags, sample_rate, stacklevel + 1)
    except Exception:
        logger = logging.getLogger("sentry.errors")
        logger.exception("Unable to record backend metric")


def distribution(
    key: str,
    value: int | float,
    instance: str | None = None,
    tags: Tags | None = None,
    sample_rate: float = settings.SENTRY_METRICS_SAMPLE_RATE,
    unit: str | None = None,
    stacklevel: int = 0,
) -> None:
    try:
        backend.distribution(key, value, instance, tags, sample_rate, unit, stacklevel + 1)
    except Exception:
        logger = logging.getLogger("sentry.errors")
        logger.exception("Unable to record backend metric")


def set(
    key: str,
    value: str | int,
    instance: str | None = None,
    tags: Tags | None = None,
    sample_rate: float = settings.SENTRY_METRICS_SAMPLE_RATE,
    stacklevel: int = 0,
) -> None:
    try:
        backend.set(key, value, instance, tags, sample_rate, stacklevel + 1)
    except Exception:
        logger = logging.getLogger("sentry.errors")
        logger.exception("Unable to record backend metric")


@contextmanager
def timer(
    key: str,
    instance: str | None = None,
    tags: Tags | None = None,
    sample_rate: float = settings.SENTRY_METRICS_SAMPLE_RATE,
    stacklevel: int = 0,
) -> Generator[MutableTags]:
    start = time.monotonic()
    current_tags: MutableTags = dict(tags or ())
    try:
        yield current_tags
    except Exception:
        current_tags["result"] = "failure"
        raise
    else:
        current_tags["result"] = "success"
    finally:
        # stacklevel must be increased by 2 because of the contextmanager indirection
        timing(key, time.monotonic() - start, instance, current_tags, sample_rate, stacklevel + 2)


def wraps(
    key: str,
    instance: str | None = None,
    tags: Tags | None = None,
    sample_rate: float = settings.SENTRY_METRICS_SAMPLE_RATE,
    stacklevel: int = 0,
) -> Callable[[F], F]:
    def wrapper(f: F) -> F:
        @functools.wraps(f)
        def inner(*args: Any, **kwargs: Any) -> Any:
            with timer(
                key,
                instance=instance,
                tags=tags,
                sample_rate=sample_rate,
                stacklevel=stacklevel + 1,
            ):
                return f(*args, **kwargs)

        return inner  # type: ignore[return-value]

    return wrapper


def event(
    title: str,
    message: str,
    alert_type: str | None = None,
    aggregation_key: str | None = None,
    source_type_name: str | None = None,
    priority: str | None = None,
    instance: str | None = None,
    tags: Tags | None = None,
    stacklevel: int = 0,
) -> None:
    try:
        backend.event(
            title,
            message,
            alert_type,
            aggregation_key,
            source_type_name,
            priority,
            instance,
            tags,
            stacklevel + 1,
        )
    except Exception:
        logger = logging.getLogger("sentry.errors")
        logger.exception("Unable to record backend metric")


def ensure_crash_rate_in_bounds(
    data: Any,
    request: Request,
    organization: Organization,
    CRASH_RATE_METRIC_KEY: str,
    lower_bound: float = 0.0,
    upper_bound: float = 1.0,
) -> None:
    """
    Ensures that crash rate metric will always have value in expected bounds, and
    that invalid value is never returned to the customer by replacing all the invalid values with
    the bound value.
    Invalid crash rate can happen due to the corrupted data that is used to calculate the metric
    (see: https://github.com/getsentry/sentry/issues/73172)

    Example format of data argument:
    {
        ...
        "groups" : [
            ...
            "series": {..., "session.crash_free_rate": [..., None, 0.35]},
            "totals": {..., "session.crash_free_rate": 0.35}
        ]
    }
    """
    groups = data["groups"]
    for group in groups:
        if "series" in group:
            series = group["series"]
            if CRASH_RATE_METRIC_KEY in series:
                for i, value in enumerate(series[CRASH_RATE_METRIC_KEY]):
                    try:
                        value = float(value)
                        if value < lower_bound or value > upper_bound:
                            with sentry_sdk.isolation_scope() as scope:
                                scope.set_tag("organization", organization.id)
                                scope.set_extra(f"{CRASH_RATE_METRIC_KEY} value in series", value)
                                scope.set_extra("request_query_params", request.query_params)
                                sentry_sdk.capture_message(
                                    f"{CRASH_RATE_METRIC_KEY} not in (f{lower_bound}, f{upper_bound})"
                                )
                            if value < lower_bound:
                                series[CRASH_RATE_METRIC_KEY][i] = lower_bound
                            else:
                                series[CRASH_RATE_METRIC_KEY][i] = upper_bound
                    except TypeError:
                        # value is not a number
                        continue

        if "totals" in group:
            totals = group["totals"]
            if CRASH_RATE_METRIC_KEY not in totals or totals[CRASH_RATE_METRIC_KEY] is None:
                # no action is needed
                continue
            value = totals[CRASH_RATE_METRIC_KEY]
            if value < lower_bound or value > upper_bound:
                with sentry_sdk.isolation_scope() as scope:
                    scope.set_tag("organization", organization.id)
                    scope.set_extra(f"{CRASH_RATE_METRIC_KEY} value", totals[CRASH_RATE_METRIC_KEY])
                    scope.set_extra("request_query_params", request.query_params)
                    sentry_sdk.capture_message(
                        f"{CRASH_RATE_METRIC_KEY} not in (f{lower_bound}, f{upper_bound})"
                    )
                if value < lower_bound:
                    totals[CRASH_RATE_METRIC_KEY] = lower_bound
                else:
                    totals[CRASH_RATE_METRIC_KEY] = upper_bound
