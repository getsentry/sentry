import logging
from typing import Optional

from sentry.dynamic_sampling.tasks.task_context import TaskContext
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def log_extrapolated_monthly_volume(
    org_id: int, project_id: Optional[int], volume: int, extrapolated_volume: int, window_size: int
) -> None:
    extra = {
        "org_id": org_id,
        "volume": volume,
        "extrapolated_monthly_volume": extrapolated_volume,
        "window_size_in_hours": window_size,
    }

    if project_id is not None:
        extra["project_id"] = project_id

    logger.info(
        "dynamic_sampling.extrapolate_monthly_volume",
        extra=extra,
    )


def log_sample_rate_source(
    org_id: int, project_id: Optional[int], used_for: str, source: str, sample_rate: Optional[float]
) -> None:
    extra = {"org_id": org_id, "sample_rate": sample_rate, "source": source, "used_for": used_for}

    if project_id is not None:
        extra["project_id"] = project_id

    logger.info(
        "dynamic_sampling.sample_rate_source",
        extra=extra,
    )


def log_task_timeout(context: TaskContext) -> None:
    logger.error("dynamic_sampling.task_timeout", extra=context.to_dict())
    metrics.incr("dynamic_sampling.task_timeout", tags={"task_name": context.name})


def log_task_execution(context: TaskContext) -> None:
    logger.info(
        "dynamic_sampling.task_execution",
        extra=context.to_dict(),
    )


def log_query_timeout(query: str, offset: int, timeout_seconds: int) -> None:
    logger.error(
        "dynamic_sampling.query_timeout",
        extra={"query": query, "offset": offset, "timeout_seconds": timeout_seconds},
    )

    # We also want to collect a metric, in order to measure how many retries we are having. It may help us to spot
    # possible problems on the Snuba end that affect query performance.
    metrics.incr("dynamic_sampling.query_timeout", tags={"query": query})


def log_recalibrate_org_error(org_id: int, error: str) -> None:
    logger.info("dynamic_sampling.recalibrate_org_error", extra={"org_id": org_id, "error": error})


def log_recalibrate_org_state(
    org_id: int, previous_factor: float, effective_sample_rate: float, target_sample_rate: float
) -> None:
    logger.info(
        "dynamic_sampling.recalibrate_org_state",
        extra={
            "org_id": org_id,
            "previous_factor": previous_factor,
            "effective_sample_rate": effective_sample_rate,
            "target_sample_rate": target_sample_rate,
            "target_effective_ratio": target_sample_rate / effective_sample_rate,
        },
    )
