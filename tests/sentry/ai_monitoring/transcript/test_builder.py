from dataclasses import FrozenInstanceError, replace
from unittest.mock import patch

import pytest

from sentry.ai_monitoring.transcript import builder as transcript
from sentry.ai_monitoring.transcript.deduplication import capture_generation
from sentry.ai_monitoring.transcript.models import ToolCall, TranscriptMessage, TranscriptSpan


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


def test_message_signature_recursion_disables_history_evidence() -> None:
    span = TranscriptSpan(
        "span-1", {"gen_ai.input.messages": "question", "gen_ai.output.messages": "answer"}
    )
    with patch(
        "sentry.ai_monitoring.transcript.deduplication.json.dumps", side_effect=RecursionError
    ):
        capture = capture_generation(span)
    assert capture.inputs is None
    assert capture.outputs is None


def test_assistant_text_takes_precedence_over_structured_output() -> None:
    span = TranscriptSpan(
        "span-1",
        {
            "gen_ai.output.messages": '[{"role":"assistant","parts":['
            '{"type":"text","text":"answer"},'
            '{"type":"object","data":{"answer":42}},'
            '{"type":"reasoning","text":"considering"}]}]',
            "gen_ai.response.object": '{"fallback":true}',
        },
    )
    result = transcript.parse_assistant_content(span)
    assert result.content == "answer"
    assert result.reasoning == "considering"
