import logging
from typing import Dict, Optional

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


def log_query_timeout(query: str, offset: int) -> None:
    logger.error("dynamic_sampling.query_timeout", extra={"query": query, "offset": offset})


def log_recalibrate_orgs_errors(errors: Dict[str, str]) -> None:
    logger.error("dynamic_sampling.recalibrate_orgs", extra={"errors": errors})
