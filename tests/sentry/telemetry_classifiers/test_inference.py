from collections.abc import Generator
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from urllib3.exceptions import TimeoutError as Urllib3TimeoutError

from sentry.models.organization import Organization
from sentry.seer.models.seer_api_models import SeerApiError
from sentry.telemetry_classifiers.definitions import resolve_prebuilt_definition
from sentry.telemetry_classifiers.inference import ClassifierExecutionError, classify
from sentry.telemetry_classifiers.types import Message

DEFINITION = resolve_prebuilt_definition("conversation_user_frustration", "conversation")
ORGANIZATION = Organization(id=1, slug="org-slug")
MESSAGES = [Message(role="user", content="This is broken"), Message(role="user", content="Again")]


def predicate(probability: Any) -> dict[str, Any]:
    return {"type": "predicate", "name": "match", "probability": probability}


@pytest.fixture
def run_oneshot() -> Generator[MagicMock]:
    with patch("sentry.telemetry_classifiers.inference.run_oneshot") as run_oneshot:
        yield run_oneshot


def test_sends_messages_and_returns_probability(run_oneshot: MagicMock) -> None:
    run_oneshot.return_value = predicate(0.91)

    assert classify(DEFINITION, MESSAGES, ORGANIZATION) == 0.91
    run_oneshot.assert_called_once_with(
        "conversation_user_frustration",
        {
            "messages": [
                {"role": "user", "content": "This is broken"},
                {"role": "user", "content": "Again"},
            ]
        },
        ORGANIZATION,
        timeout=20,
    )


@pytest.mark.parametrize("probability", [0, 1])
def test_accepts_boundary_probabilities(run_oneshot: MagicMock, probability: int) -> None:
    run_oneshot.return_value = predicate(probability)

    assert classify(DEFINITION, MESSAGES, ORGANIZATION) == float(probability)


@pytest.mark.parametrize(
    "result",
    [
        [0.5],
        {},
        {"type": "score", "name": "match", "probability": 0.5},
        {"type": "predicate", "name": "other", "probability": 0.5},
        predicate(None),
        predicate(True),
        predicate("0.5"),
        predicate(float("nan")),
        predicate(-0.1),
        predicate(1.1),
    ],
)
def test_rejects_malformed_results(run_oneshot: MagicMock, result: Any) -> None:
    run_oneshot.return_value = result

    with pytest.raises(ClassifierExecutionError) as error:
        classify(DEFINITION, MESSAGES, ORGANIZATION)

    assert (error.value.reason, error.value.retryable) == ("invalid_response", False)


@pytest.mark.parametrize(
    ("failure", "reason", "retryable"),
    [
        (SeerApiError("unavailable", 503), "seer_error", True),
        (SeerApiError("slow down", 429), "seer_error", True),
        (SeerApiError("bad payload", 400), "seer_error", False),
        (Urllib3TimeoutError("timed out"), "seer_unavailable", True),
    ],
)
def test_classifies_seer_failures(
    run_oneshot: MagicMock, failure: Exception, reason: str, retryable: bool
) -> None:
    run_oneshot.side_effect = failure

    with pytest.raises(ClassifierExecutionError) as error:
        classify(DEFINITION, MESSAGES, ORGANIZATION)

    assert (error.value.reason, error.value.retryable) == (reason, retryable)
