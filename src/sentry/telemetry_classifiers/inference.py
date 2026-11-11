from __future__ import annotations

import math
from collections.abc import Mapping, Sequence

from urllib3.exceptions import HTTPError

from sentry.models.organization import Organization
from sentry.seer.models.seer_api_models import SeerApiError
from sentry.seer.oneshot import run_oneshot
from sentry.telemetry_classifiers.constants import SEER_TIMEOUT_SECONDS
from sentry.telemetry_classifiers.types import Message, ResolvedDefinition
from sentry.utils import metrics


class ClassifierExecutionError(Exception):
    """Seer didn't produce a usable result. ``retryable`` says whether a retry may succeed."""

    def __init__(self, reason: str, *, retryable: bool) -> None:
        super().__init__(reason)
        self.reason = reason
        self.retryable = retryable


def classify(
    definition: ResolvedDefinition,
    messages: Sequence[Message],
    organization: Organization,
) -> float:
    """Run the definition's Seer classifier model and return the probability of a "yes" answer.

    Only binary classifiers exist yet. Raises ClassifierExecutionError.
    """
    payload = {
        "messages": [{"role": message.role, "content": message.content} for message in messages]
    }
    try:
        with metrics.timer(
            "telemetry_classifiers.inference.duration", tags={"model": definition.key}
        ):
            result = run_oneshot(
                definition.key, payload, organization, timeout=SEER_TIMEOUT_SECONDS
            )
    except SeerApiError as error:
        raise ClassifierExecutionError(
            "seer_error", retryable=error.status == 429 or error.status >= 500
        ) from error
    except HTTPError as error:
        # Timeouts and connection failures.
        raise ClassifierExecutionError("seer_unavailable", retryable=True) from error

    return _parse_probability(result)


def _parse_probability(result: object) -> float:
    if not isinstance(result, Mapping):
        raise ClassifierExecutionError("invalid_response", retryable=False)
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
