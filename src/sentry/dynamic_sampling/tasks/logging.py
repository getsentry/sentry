import logging
from collections.abc import Sequence
from typing import Any

from sentry.dynamic_sampling.tasks.task_context import TaskContext
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def log_extrapolated_monthly_volume(
    org_id: int, project_id: int | None, volume: int, extrapolated_volume: int, window_size: int
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
    org_id: int, project_id: int | None, used_for: str, source: str, sample_rate: float | None
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


def log_custom_rule_progress(
    org_id: int,
    project_ids: Sequence[int],
    rule_id: int,
    samples_count: int,
    min_samples_count: int,
):
    extra: dict[str, Any] = {
        "org_id": org_id,
        "rule_id": rule_id,
        "samples_count": samples_count,
        "min_samples_count": min_samples_count,
    }

    if project_ids:
        extra["project_ids"] = project_ids

    logger.info(
        "dynamic_sampling.custom_rule_progress",
        extra=extra,
    )
