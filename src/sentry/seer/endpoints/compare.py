from __future__ import annotations

import logging
from typing import Any

import orjson

from sentry.seer.models import SeerApiError
from sentry.seer.signed_seer_api import (
    make_signed_seer_api_request,
    seer_anomaly_detection_default_connection_pool,
)
from sentry.utils.json import JSONDecodeError

logger = logging.getLogger(__name__)


def compare_distributions(
    baseline: list,
    outliers: list,
    total_baseline: int,
    total_outliers: int,
    config: dict[str, Any],
    meta: dict[str, Any],
) -> Any:
    """
    Sends a request to seer to compare two distributions and rank their attributes by suspisiouness
    """

    body = orjson.dumps(
        {
            "baseline": baseline,
            "outliers": outliers,
            "total_baseline": total_baseline,
            "total_outliers": total_outliers,
            "config": config,
            "meta": meta,
        }
    )
    response = make_signed_seer_api_request(
        seer_anomaly_detection_default_connection_pool,
        "/v1/workflows/compare/cohort",
        body,
    )
    if response.status >= 400:
        raise SeerApiError("Seer request failed", response.status)
    try:
        return response.json()
    except JSONDecodeError:
        logger.exception("Failed to parse Seer compare_distributions response")
        raise SeerApiError("Seer returned invalid JSON response", response.status)
