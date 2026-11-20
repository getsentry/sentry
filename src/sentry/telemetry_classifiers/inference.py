from __future__ import annotations

import math
from collections.abc import Mapping, Sequence
from typing import Any

from urllib3.exceptions import HTTPError

from sentry.models.organization import Organization
from sentry.seer.models.seer_api_models import SeerApiError
from sentry.seer.oneshot import run_oneshot
from sentry.telemetry_classifiers.constants import SEER_TIMEOUT_SECONDS
from sentry.telemetry_classifiers.types import Event, ResolvedDefinition
from sentry.utils import metrics


class ClassifierExecutionError(Exception):
    """Seer didn't produce a usable result. ``retryable`` says whether a retry may succeed."""

    def __init__(self, reason: str, *, retryable: bool) -> None:
        super().__init__(reason)
        self.reason = reason
        self.retryable = retryable


def classify(
    definition: ResolvedDefinition,
    events: Sequence[Event],
    organization: Organization,
) -> dict[str, Any]:
    """Run the definition's Seer classifier model on events and return its result.

    The result's shape depends on the definition's output type; read it with the matching parser,
    such as parse_binary_result. Raises ClassifierExecutionError.
    """
    try:
        with metrics.timer(
            "telemetry_classifiers.inference.duration", tags={"model": definition.key}
        ):
            result: object = run_oneshot(
                definition.key,
                {"events": list(events)},
                organization,
                timeout=SEER_TIMEOUT_SECONDS,
            )
    except SeerApiError as error:
        raise ClassifierExecutionError(
            "seer_error", retryable=error.status == 429 or error.status >= 500
        ) from error
    except HTTPError as error:
        # Timeouts and connection failures.
        raise ClassifierExecutionError("seer_unavailable", retryable=True) from error

    if not isinstance(result, dict):
        raise ClassifierExecutionError("invalid_response", retryable=False)
    return result


def parse_binary_result(result: Mapping[str, Any]) -> float:
    """Return the probability of a "yes" answer from a binary classifier's result."""
    probability = result.get("probability")
    if (
        result.get("type") != "predicate"
        or result.get("name") != "match"
        or isinstance(probability, bool)
        or not isinstance(probability, int | float)
        or not math.isfinite(probability)
        or not 0 <= probability <= 1
    ):
        raise ClassifierExecutionError("invalid_response", retryable=False)
    return float(probability)
