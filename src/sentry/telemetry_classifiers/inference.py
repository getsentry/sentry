from __future__ import annotations

import math
from collections.abc import Mapping
from typing import Any

from urllib3.exceptions import HTTPError

from sentry.seer.models.seer_api_models import SeerApiError
from sentry.seer.oneshot import run_oneshot
from sentry.telemetry_classifiers.types import (
    BinaryResult,
    ClassificationResult,
    ClassifierModelContract,
    ExecutionContext,
    InputSpec,
    PreparedInput,
    ResolvedDefinition,
)
from sentry.utils import metrics


class ClassifierExecutionError(Exception):
    """The classifier model didn't produce a usable result."""

    def __init__(self, reason: str, *, retryable: bool) -> None:
        super().__init__(reason)
        self.reason = reason
        self.retryable = retryable


class InvalidClassifierResponse(ClassifierExecutionError):
    """Seer answered, but the output doesn't match the model's contract. Retrying won't help."""

    def __init__(self) -> None:
        super().__init__("invalid_response", retryable=False)


def conversation_messages_payload(prepared: PreparedInput) -> dict[str, Any]:
    return {
        "messages": [
            {"role": message.role, "content": message.content} for message in prepared.messages
        ]
    }


def parse_binary_predicate(result: Mapping[str, Any]) -> BinaryResult:
    probability = result.get("probability")
    if (
        result.get("type") != "predicate"
        or result.get("name") != "match"
        or isinstance(probability, bool)
        or not isinstance(probability, int | float)
        or not math.isfinite(probability)
        or not 0 <= probability <= 1
    ):
        raise InvalidClassifierResponse()
    return BinaryResult(probability=float(probability))


# Conversation classifier models that answer a yes/no question about the user's messages.
CONVERSATION_USER_MESSAGES_BINARY = ClassifierModelContract(
    input_spec=InputSpec(roles=frozenset({"user"}), max_chars=32_000),
    build_payload=conversation_messages_payload,
    parse_result=parse_binary_predicate,
    timeout_seconds=20,
)


def execute_classifier(
    definition: ResolvedDefinition,
    prepared: PreparedInput,
    context: ExecutionContext,
) -> ClassificationResult:
    """Run the definition's classifier model on prepared input and return its validated result.

    Raises ClassifierExecutionError when Seer fails or returns output that breaks the contract.
    Its ``retryable`` flag says whether the same request may succeed later.
    """
    contract = definition.contract
    payload = contract.build_payload(prepared)
    try:
        with metrics.timer(
            "telemetry_classifiers.inference.duration", tags={"model": definition.key}
        ):
            result = run_oneshot(
                definition.key,
                payload,
                context.organization,
                timeout=contract.timeout_seconds,
            )
    except SeerApiError as error:
        raise ClassifierExecutionError(
            "seer_error", retryable=error.status == 429 or error.status >= 500
        ) from error
    except HTTPError as error:
        # Timeouts and connection failures.
        raise ClassifierExecutionError("seer_unavailable", retryable=True) from error

    if not isinstance(result, Mapping):
        raise InvalidClassifierResponse()
    return contract.parse_result(result)
