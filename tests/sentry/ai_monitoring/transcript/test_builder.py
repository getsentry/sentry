from dataclasses import FrozenInstanceError, replace
from unittest.mock import patch

import pytest

from sentry.ai_monitoring.transcript import builder as transcript
from sentry.ai_monitoring.transcript.models import ToolCall, TranscriptMessage, TranscriptSpan
from sentry.ai_monitoring.transcript.normalized_span import normalize_ai_span
from sentry.utils import json


def test_malformed_parent_cycles_cannot_hang_the_backend() -> None:
    rows = [
        {
            "span_id": span_id,
            "parent_span": parent_id,
            "span.name": "gen_ai.chat",
            "gen_ai.operation.type": "ai_client",
            "precise.start_ts": index,
            "precise.finish_ts": index + 0.5,
            "gen_ai.usage.input_tokens": 1,
        }
        for index, (span_id, parent_id) in enumerate([("first", "second"), ("second", "first")])
    ]
    messages = transcript.build_transcript(rows)
    assert [(message["role"], message["content"]) for message in messages] == [
        ("user", transcript.NOT_REPORTED),
        ("user", transcript.NOT_REPORTED),
    ]


def test_messages_serialize_only_api_fields_and_preserve_falsey_values() -> None:
    message = TranscriptMessage(
        id="embedding-span-1",
        role="embedding",
        content="",
        timestamp=0,
        span_id="span-1",
        user_email="",
        embedding_has_error=False,
        embedding_tokens=0,
        tool_calls=(),
    )
    assert message.to_api() == {
        "id": "embedding-span-1",
        "role": "embedding",
        "content": "",
        "timestamp": 0,
        "nodeId": "span-1",
        "userEmail": "",
        "embeddingHasError": False,
        "embeddingTokens": 0,
        "toolCalls": [],
    }


def test_serialization_preserves_tool_calls_without_dataclass_field_names() -> None:
    message = TranscriptMessage(
        id="assistant-span-1",
        role="assistant",
        content="answer",
        timestamp=2,
        span_id="span-1",
        tool_calls=(ToolCall("lookup", "tool-1", False, 0.5),),
    )
    assert message.to_api().get("toolCalls") == [
        {"name": "lookup", "nodeId": "tool-1", "hasError": False, "duration": 0.5}
    ]
    assert "span_id" not in message.to_api()
    assert "reasoning" not in message.to_api()


def test_span_records_are_frozen_and_updates_do_not_mutate_original_attributes() -> None:
    original = TranscriptSpan("span-1", {"gen_ai.input.messages": "question"})
    updated = replace(
        original, attributes={**original.attributes, "gen_ai.output.messages": "answer"}
    )
    assert original.attributes == {"gen_ai.input.messages": "question"}
    assert updated.attributes["gen_ai.output.messages"] == "answer"
    with pytest.raises(FrozenInstanceError):
        setattr(original, "span_id", "different")


def test_internal_spans_and_events_are_typed_records() -> None:
    row = {
        "span_id": "span-1",
        "span.name": "gen_ai.chat",
        "gen_ai.operation.type": "ai_client",
        "precise.start_ts": 1,
        "precise.finish_ts": 2,
        "gen_ai.output.messages": "answer",
    }
    spans = transcript.build_conversation_spans([row])
    assert isinstance(spans[0], TranscriptSpan)
    context = transcript.TranscriptContext(rows={transcript.source_key(row): row})
    events = transcript.normalize_events(context)
    assert isinstance(events[0], transcript.TranscriptEvent)
    assert events[0].message["content"] == "answer"
    assert transcript.build_transcript([row]) == [event.message for event in events]


class TestNormalizeAISpan:
    def test_decoder_recursion_limit_preserves_raw_structured_payload(self) -> None:
        raw = '["value"]'
        with patch(
            "sentry.ai_monitoring.transcript.normalized_span.json.loads", side_effect=RecursionError
        ):
            result = normalize_ai_span(
                {"span_id": "span-1", "gen_ai.input.messages": raw, "gen_ai.response.object": raw}
            )
        assert result["inputMessages"] == [{"role": "user", "content": "value"}]
        assert result["responseObject"] == raw

    def test_messages_instructions_and_structured_output(self) -> None:
        row = {
            "span_id": "generation-1",
            "trace": "trace-1",
            "project.id": 1,
            "gen_ai.input.messages": json.dumps([{"role": "user", "content": "hello"}]),
            "gen_ai.system_instructions": "Be helpful",
            "gen_ai.output.messages": json.dumps(
                [
                    {
                        "role": "assistant",
                        "parts": [
                            {"type": "reasoning", "text": "considering"},
                            {"type": "text", "text": "answer"},
                            {"type": "object", "data": {"answer": 42}},
                            {
                                "type": "tool_call",
                                "id": "call-1",
                                "name": "lookup",
                                "arguments": {"query": "hello"},
                            },
                        ],
                    }
                ]
            ),
        }
        result = normalize_ai_span(row)
        assert result["spanId"] == "generation-1"
        assert result["traceId"] == "trace-1"
        assert result["projectId"] == "1"
        assert result["inputMessages"] == [{"role": "user", "content": "hello"}]
        assert result["systemInstructions"] == [{"role": "system", "content": "Be helpful"}]
        assert result["responseText"] == "answer"
        assert result["reasoning"] == "considering"
        assert result["responseObject"] == {"type": "object", "data": {"answer": 42}}
        assert result["toolCalls"] == [
            {"type": "tool_call", "id": "call-1", "name": "lookup", "arguments": {"query": "hello"}}
        ]

    def test_tool_status_errors_and_results(self) -> None:
        result = normalize_ai_span(
            {
                "span_id": "tool-1",
                "gen_ai.tool.name": "lookup",
                "span.status": "internal_error",
                "gen_ai.tool.call.arguments": '{"query":"hello"}',
                "gen_ai.tool.call.result": '{"error":"unavailable"}',
                "errors": [{"issue_id": 1, "event_id": "event-1"}],
            }
        )
        assert result["status"] == "internal_error"
        assert result["errors"] == [{"issue_id": 1, "event_id": "event-1"}]
        assert result["toolName"] == "lookup"
        assert result["toolArguments"] == {"query": "hello"}
        assert result["toolResult"] == {"error": "unavailable"}

    def test_unsupported_payloads_are_preserved(self) -> None:
        result = normalize_ai_span(
            {
                "span_id": "tool-1",
                "gen_ai.tool.call.arguments": "{broken",
                "anthropic.tool_result.content": "<unsupported>payload</unsupported>",
                "gen_ai.response.object": '{"answer":42}',
            }
        )
        assert result["toolArguments"] == "{broken"
        assert result["toolResult"] == "<unsupported>payload</unsupported>"
        assert result["responseObject"] == {"answer": 42}
        assert result["errors"] == []
        assert result["inputMessages"] is None

    def test_canonical_input_and_result_take_priority(self) -> None:
        result = normalize_ai_span(
            {
                "span_id": "tool-1",
                "gen_ai.input.messages": "canonical",
                "gen_ai.request.messages": "legacy",
                "gen_ai.tool.call.result": "false",
                "anthropic.tool_result.content": "legacy result",
            }
        )
        assert result["inputMessages"] == [{"role": "user", "content": "canonical"}]
        assert result["toolResult"] is False
