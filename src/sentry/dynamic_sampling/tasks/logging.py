import logging

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
