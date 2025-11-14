from __future__ import annotations

import logging
from typing import int, Any

import orjson
import requests
from django.conf import settings

from sentry.seer.signed_seer_api import sign_with_seer_secret

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
    response = requests.post(
        f"{settings.SEER_ANOMALY_DETECTION_URL}/v1/workflows/compare/cohort",
        data=body,
        headers={
            "content-type": "application/json;charset=utf-8",
            **sign_with_seer_secret(body),
        },
    )
    response.raise_for_status()
    return response.json()
