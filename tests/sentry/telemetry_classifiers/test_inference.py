from typing import Any
from unittest.mock import patch

import pytest
from urllib3.exceptions import TimeoutError as Urllib3TimeoutError

from sentry.seer.models.seer_api_models import SeerApiError
from sentry.telemetry_classifiers.definitions import resolve_prebuilt_definition
from sentry.telemetry_classifiers.inference import (
    ClassifierExecutionError,
    InvalidClassifierResponse,
    conversation_messages_payload,
    execute_classifier,
    parse_binary_predicate,
)
from sentry.telemetry_classifiers.types import (
    BinaryResult,
    ExecutionContext,
    Message,
    PreparedInput,
)
from sentry.testutils.cases import TestCase

PREPARED = PreparedInput(
    messages=(
        Message(role="user", content="This is broken"),
        Message(role="user", content="Again"),
    ),
    input_truncated=False,
    source_truncated=False,
)


def test_conversation_messages_payload() -> None:
    assert conversation_messages_payload(PREPARED) == {
        "messages": [
            {"role": "user", "content": "This is broken"},
            {"role": "user", "content": "Again"},
        ]
    }


@pytest.mark.parametrize("probability", [0, 0.02, 0.5, 1])
def test_parse_binary_predicate_accepts_probabilities(probability: float) -> None:
    result = {"type": "predicate", "name": "match", "probability": probability}

    assert parse_binary_predicate(result) == BinaryResult(probability=float(probability))


@pytest.mark.parametrize(
    "result",
    [
        {},
        {"type": "score", "name": "match", "probability": 0.5},
        {"type": "predicate", "name": "other", "probability": 0.5},
        {"type": "predicate", "name": "match"},
        {"type": "predicate", "name": "match", "probability": True},
        {"type": "predicate", "name": "match", "probability": "0.5"},
        {"type": "predicate", "name": "match", "probability": float("nan")},
        {"type": "predicate", "name": "match", "probability": -0.1},
        {"type": "predicate", "name": "match", "probability": 1.1},
    ],
)
def test_parse_binary_predicate_rejects_malformed_output(result: dict[str, Any]) -> None:
    with pytest.raises(InvalidClassifierResponse):
        parse_binary_predicate(result)


@patch("sentry.telemetry_classifiers.inference.run_oneshot")
class ExecuteClassifierTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.definition = resolve_prebuilt_definition(
            "conversation_user_frustration", "conversation"
        )
        self.context = ExecutionContext(
            organization=self.organization,
            project=self.project,
            classifier_id=1,
            result_attribute="sentry.enrichment.user_frustration",
        )

    def test_returns_validated_result(self, run_oneshot: Any) -> None:
        run_oneshot.return_value = {"type": "predicate", "name": "match", "probability": 0.91}

        result = execute_classifier(self.definition, PREPARED, self.context)

        assert result == BinaryResult(probability=0.91)
        run_oneshot.assert_called_once_with(
            "conversation_user_frustration",
            conversation_messages_payload(PREPARED),
            self.organization,
            timeout=20,
        )

    def test_negative_answer_is_a_result(self, run_oneshot: Any) -> None:
        run_oneshot.return_value = {"type": "predicate", "name": "match", "probability": 0.0}

        assert execute_classifier(self.definition, PREPARED, self.context) == BinaryResult(
            probability=0.0
        )

    def test_malformed_output_is_not_retryable(self, run_oneshot: Any) -> None:
        run_oneshot.return_value = {"type": "predicate", "name": "match", "probability": 2}

        with pytest.raises(InvalidClassifierResponse) as error:
            execute_classifier(self.definition, PREPARED, self.context)
        assert not error.value.retryable

    def test_non_mapping_output_is_not_retryable(self, run_oneshot: Any) -> None:
        run_oneshot.return_value = [0.5]

        with pytest.raises(InvalidClassifierResponse):
            execute_classifier(self.definition, PREPARED, self.context)

    def test_server_errors_and_rate_limits_are_retryable(self, run_oneshot: Any) -> None:
        run_oneshot.side_effect = [SeerApiError("unavailable", 503), SeerApiError("slow down", 429)]

        with pytest.raises(ClassifierExecutionError) as unavailable:
            execute_classifier(self.definition, PREPARED, self.context)
        with pytest.raises(ClassifierExecutionError) as rate_limited:
            execute_classifier(self.definition, PREPARED, self.context)

        assert unavailable.value.reason == "seer_error"
        assert unavailable.value.retryable
        assert rate_limited.value.retryable

    def test_client_errors_are_not_retryable(self, run_oneshot: Any) -> None:
        run_oneshot.side_effect = SeerApiError("bad payload", 400)

        with pytest.raises(ClassifierExecutionError) as error:
            execute_classifier(self.definition, PREPARED, self.context)

        assert error.value.reason == "seer_error"
        assert not error.value.retryable

    def test_timeouts_are_retryable(self, run_oneshot: Any) -> None:
        run_oneshot.side_effect = Urllib3TimeoutError("timed out")

        with pytest.raises(ClassifierExecutionError) as error:
            execute_classifier(self.definition, PREPARED, self.context)

        assert error.value.reason == "seer_unavailable"
        assert error.value.retryable
