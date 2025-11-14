from typing import int
import logging

logger = logging.getLogger(__name__)


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
