from collections.abc import Generator
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from urllib3.exceptions import TimeoutError as Urllib3TimeoutError

from sentry.models.organization import Organization
from sentry.seer.models.seer_api_models import SeerApiError
from sentry.telemetry_classifiers.definitions import resolve_prebuilt_definition
from sentry.telemetry_classifiers.inference import (
    ClassifierExecutionError,
    classify,
    parse_binary_result,
)

DEFINITION = resolve_prebuilt_definition("conversation_user_frustration", "conversation")
ORGANIZATION = Organization(id=1, slug="org-slug")
EVENTS = [{"content": "This is broken"}, {"content": "Again"}]


def predicate(probability: Any) -> dict[str, Any]:
    return {"type": "predicate", "name": "match", "probability": probability}


@pytest.fixture
def run_oneshot() -> Generator[MagicMock]:
    with patch("sentry.telemetry_classifiers.inference.run_oneshot") as run_oneshot:
        yield run_oneshot


def test_sends_events_and_returns_result(run_oneshot: MagicMock) -> None:
    run_oneshot.return_value = predicate(0.91)

    assert classify(DEFINITION, EVENTS, ORGANIZATION) == predicate(0.91)
    run_oneshot.assert_called_once_with(
        "conversation_user_frustration",
        {"events": EVENTS},
        ORGANIZATION,
        timeout=20,
    )


def test_rejects_non_object_results(run_oneshot: MagicMock) -> None:
    run_oneshot.return_value = [0.5]

    with pytest.raises(ClassifierExecutionError) as error:
        classify(DEFINITION, EVENTS, ORGANIZATION)

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
        classify(DEFINITION, EVENTS, ORGANIZATION)

    assert (error.value.reason, error.value.retryable) == (reason, retryable)


@pytest.mark.parametrize("probability", [0, 0.02, 1])
def test_parse_binary_result_returns_probability(probability: float) -> None:
    assert parse_binary_result(predicate(probability)) == float(probability)


@pytest.mark.parametrize(
    "result",
    [
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
def test_parse_binary_result_rejects_malformed_results(result: dict[str, Any]) -> None:
    with pytest.raises(ClassifierExecutionError) as error:
        parse_binary_result(result)

    assert (error.value.reason, error.value.retryable) == ("invalid_response", False)
