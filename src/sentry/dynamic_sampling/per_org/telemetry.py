from __future__ import annotations

import functools
import logging
from collections.abc import Callable, Generator, Mapping
from contextlib import contextmanager
from enum import StrEnum
from typing import TYPE_CHECKING, TypeVar

import sentry_sdk

from sentry.dynamic_sampling.per_org.gate import (
    is_killswitch_engaged,
    is_org_in_sample_rates_summary_log_rollout,
    is_rollout_enabled,
    metrics_sample_rate,
)
from sentry.utils import metrics
from sentry.utils.snuba_rpc import SnubaRPCError, SnubaRPCTimeout

if TYPE_CHECKING:
    from sentry.dynamic_sampling.per_org.configuration import BaseDynamicSamplingConfiguration

logger = logging.getLogger(__name__)

F = TypeVar("F", bound=Callable[..., object])

METRIC_PREFIX = "dynamic_sampling"

SCHEDULER_BUCKET_ORG_STATUS_METRIC = (
    "dynamic_sampling.schedule_per_org_calculations_bucket.org_status"
)

SERVING_SOURCE_METRIC = "dynamic_sampling.per_org.serving_source"


class ServedValue(StrEnum):
    """The piece of data rule generation reads from a cache."""

    PROJECT_SAMPLE_RATE = "project_sample_rate"
    TRANSACTION_SAMPLE_RATES = "transaction_sample_rates"


class ServingSource(StrEnum):
    """Where a value that rule generation served came from."""

    # The value a pass stored.
    PER_ORG = "per_org"
    # The organization has no stored project rates, so the fallback rate is served.
    PER_ORG_FALLBACK = "per_org_fallback"
    # Nothing is stored for this project.
    PER_ORG_NO_DATA = "per_org_no_data"


def emit_serving_source(value: ServedValue, source: ServingSource) -> None:
    """Record where a value that rule generation served came from.

    Sampled like the rest of the per-org metrics, since this runs on every rule generation.
    """
    metrics.incr(
        SERVING_SOURCE_METRIC,
        sample_rate=metrics_sample_rate(),
        tags={"value": value.value, "source": source.value},
    )


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
            except SnubaRPCTimeout:
                emit_status(status_metric, DynamicSamplingStatus.SNUBA_TIMEOUT)
                raise
            except SnubaRPCError:
                emit_status(status_metric, DynamicSamplingStatus.SNUBA_ERROR)
                raise
            except Exception as exc:
                emit_status(status_metric, DynamicSamplingStatus.FAILED)
                sentry_sdk.capture_exception(exc)
                raise

            status = set_duration_status(result)

        emit_status(status_metric, status)
        return result

    return wrapper  # type: ignore[return-value]


def log_sample_rates_summary(config: BaseDynamicSamplingConfiguration) -> None:
    """Log every sample rate a pass computed for an organization, for debugging."""
    if not is_org_in_sample_rates_summary_log_rollout(config.organization.id):
        return

    try:
        results = config.results
        project_sample_rates = config.get_project_sample_rates()
        projects_summary = {}
        for project in config.projects:
            named_rates, implicit_rate = results.rebalanced_transactions.get(project.id, ([], None))
            projects_summary[str(project.id)] = {
                "eap_sample_rate": project_sample_rates.get(project.id),
                "eap_transaction_implicit_sample_rate": implicit_rate,
                "eap_transaction_sample_rates": {
                    str(item.id): item.new_sample_rate for item in named_rates
                },
            }

        logger.info(
            "dynamic_sampling.per_org.sample_rates_summary",
            extra={
                "org_id": config.organization.id,
                "eap_org_sample_rate": config.get_sample_rate(),
                "eap_org_serving_sample_rate": config.get_serving_sample_rate(),
                "recalibration_factor": results.recalibration_factor,
                "projects": projects_summary,
            },
        )
    except Exception as exc:
        sentry_sdk.capture_exception(exc)
