"""Build ordered conversation transcripts from AI spans.

The event contract is shared by full responses and paginated windows. Duplicate
suppression requires adjacent, agent-scoped capture evidence, never rendered
text alone. Tool executions own independent events; later events cannot rewrite
an earlier assistant turn. Timestamps and durations are seconds.
"""

import json  # noqa: S003
import math
from collections import defaultdict
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, replace
from dataclasses import field as dataclass_field
from typing import Literal

from sentry.ai_monitoring.message_normalizer import (
    EMPTY_TEXT_CONTENT,
    extract_assistant_output,
    normalize_to_messages,
)
from sentry.ai_monitoring.transcript.attributes import MEMORY_OPERATIONS, get_evaluation, get_memory
from sentry.ai_monitoring.transcript.deduplication import (
    GenerationCapture,
    capture_generation,
    is_duplicate_assistant_message,
    is_user_history_continuation,
)
from sentry.ai_monitoring.transcript.models import (
    AssistantContent,
    SpanGroups,
    ToolCall,
    TranscriptMessage,
    TranscriptMessageResponse,
    TranscriptSpan,
)

FILTERED = "[Filtered]"
NOT_REPORTED = "<not reported>"


def string_attr(span: TranscriptSpan, field: str) -> str | None:
    value = span.attributes.get(field)
    return value if isinstance(value, str) else None


def number_attr(span: TranscriptSpan, field: str) -> float | None:
    value = span.attributes.get(field)
    if isinstance(value, bool) or not isinstance(value, (str, int, float)):
        return None
    try:
        number = float(value.strip() or "0") if isinstance(value, str) else float(value)
    except ValueError:
        return None
    return number if math.isfinite(number) else None


def has_error(span: TranscriptSpan) -> bool:
    status = string_attr(span, "span.status") or string_attr(span, "status") or ""
    return span.has_errors or "error" in status


def _duration(span: TranscriptSpan) -> float | None:
    duration = span.end_timestamp - span.start_timestamp
    return duration if duration > 0 else None


def _blank_to_null(content: str | None) -> str | None:
    return content if content and content.strip() else None


def parse_user_content(span: TranscriptSpan) -> str | None:
    raw = string_attr(span, "gen_ai.input.messages") or string_attr(span, "gen_ai.request.messages")
    if not raw or raw == FILTERED:
        return raw or None
    for message in reversed(normalize_to_messages(raw, "user") or []):
        if message["role"] == "user":
            return message["content"] if isinstance(message["content"], str) else None
    return None


def parse_assistant_content(span: TranscriptSpan) -> AssistantContent:
    raw = string_attr(span, "gen_ai.output.messages")
    if raw:
        if raw == FILTERED:
            return AssistantContent(FILTERED)
        output = extract_assistant_output(raw, "assistant")
        if output["response_text"] or output["response_object"]:
            return AssistantContent(
                output["response_text"] or output["response_object"], output["reasoning_text"]
            )
        if output["tool_calls"] or output["reasoning_text"]:
            return AssistantContent(reasoning=output["reasoning_text"])
    text = string_attr(span, "gen_ai.response.text")
    if text:
        output = extract_assistant_output(text, "assistant")
        return AssistantContent(
            None if not output["response_text"] and output["tool_calls"] is not None else text
        )
    return AssistantContent(string_attr(span, "gen_ai.response.object"))


def _parse_assistant_steps(raw: str) -> list[str] | None:
    try:
        parsed = json.loads(raw)
    except (ValueError, RecursionError):
        return None
    if not isinstance(parsed, list):
        return None
    return [
        json.dumps([message], ensure_ascii=False, separators=(",", ":"))
        for message in parsed
        if isinstance(message, dict) and message.get("role") == "assistant"
    ]


def _group_generation_children_by_agent(
    spans: Sequence[TranscriptSpan],
) -> dict[str, list[TranscriptSpan]]:
    groups: dict[str, list[TranscriptSpan]] = defaultdict(list)
    for span in spans:
        if span.parent_span_id and string_attr(span, "gen_ai.operation.type") == "ai_client":
            groups[span.parent_span_id].append(span)
    for siblings in groups.values():
        siblings.sort(key=lambda span: span.start_timestamp)
    return groups


def _build_agent_child_overrides(
    children: Sequence[TranscriptSpan], raw_input: str | None, raw_output: str
) -> dict[str, dict[str, str]]:
    overrides: dict[str, dict[str, str]] = {}
    steps = _parse_assistant_steps(raw_output)
    if steps is not None and len(steps) == len(children):
        for index, (child, step) in enumerate(zip(children, steps)):
            overrides[child.span_id] = {"gen_ai.output.messages": step}
            if index == 0 and raw_input:
                overrides[child.span_id]["gen_ai.input.messages"] = raw_input
    else:
        if raw_input:
            overrides[children[0].span_id] = {"gen_ai.input.messages": raw_input}
        overrides.setdefault(children[-1].span_id, {})["gen_ai.output.messages"] = raw_output
    return overrides


def enrich_agent_messages(spans: Sequence[TranscriptSpan]) -> list[TranscriptSpan]:
    children_by_agent = _group_generation_children_by_agent(spans)
    overrides: dict[str, dict[str, str]] = {}
    for span in spans:
        if string_attr(span, "gen_ai.operation.type") != "agent":
            continue
        raw_output = string_attr(span, "gen_ai.output.messages")
        children = children_by_agent.get(span.span_id, [])
        if not raw_output or raw_output == FILTERED or not children:
            continue
        if any(
            any(
                string_attr(child, field)
                for field in (
                    "gen_ai.input.messages",
                    "gen_ai.request.messages",
                    "gen_ai.output.messages",
                    "gen_ai.response.text",
                )
            )
            for child in children
        ):
            continue
        raw_input = string_attr(span, "gen_ai.input.messages") or string_attr(
            span, "gen_ai.request.messages"
        )
        overrides.update(_build_agent_child_overrides(children, raw_input, raw_output))
    return [
        replace(span, attributes={**span.attributes, **overrides[span.span_id]})
        if span.span_id in overrides
        else span
        for span in spans
    ]


def partition_spans_by_type(spans: Sequence[TranscriptSpan]) -> SpanGroups:
    groups = SpanGroups()
    for span in spans:
        operation = string_attr(span, "gen_ai.operation.name")
        operation_type = string_attr(span, "gen_ai.operation.type")
        if operation in ("evaluate", "decide"):
            groups.evaluations.append(span)
        elif operation in MEMORY_OPERATIONS:
            groups.memory.append(span)
        elif operation == "embeddings":
            groups.embeddings.append(span)
        elif operation_type == "ai_client":
            groups.generations.append(span)
        elif operation_type == "tool":
            groups.tools.append(span)
    for group in (
        groups.generations,
        groups.tools,
        groups.embeddings,
        groups.evaluations,
        groups.memory,
    ):
        group.sort(key=lambda span: span.end_timestamp)
    return groups


def embedding_spans_to_messages(spans: Sequence[TranscriptSpan]) -> list[TranscriptMessage]:
    messages = []
    for span in spans:
        input_text = string_attr(span, "gen_ai.embeddings.input")
        if not input_text:
            continue
        tokens = number_attr(span, "gen_ai.usage.total_tokens")
        messages.append(
            TranscriptMessage(
                id=f"embedding-{span.span_id}",
                role="embedding",
                content="",
                timestamp=span.end_timestamp,
                span_id=span.span_id,
                embedding_input=input_text,
                embedding_has_error=has_error(span),
                embedding_tokens=tokens if tokens and tokens > 0 else None,
                duration=_duration(span),
            )
        )
    return messages


def evaluation_spans_to_messages(spans: Sequence[TranscriptSpan]) -> list[TranscriptMessage]:
    return [
        TranscriptMessage(
            id=f"evaluation-{span.span_id}",
            role="evaluation",
            content="",
            timestamp=span.end_timestamp,
            span_id=span.span_id,
            duration=_duration(span),
            evaluation=get_evaluation(span.attributes),
        )
        for span in spans
    ]


def memory_spans_to_messages(spans: Sequence[TranscriptSpan]) -> list[TranscriptMessage]:
    return [
        TranscriptMessage(
            id=f"memory-{span.span_id}",
            role="memory",
            content="",
            timestamp=span.end_timestamp,
            span_id=span.span_id,
            duration=_duration(span),
            memory=get_memory(span.attributes),
        )
        for span in spans
    ]


Row = Mapping[str, object]
SourceKey = tuple[int, str, str]
EventKey = tuple[float, int, str, str, int]
Stream = Literal["start", "end"]


class TranscriptContextError(ValueError):
    pass


class TranscriptContextReadError(TranscriptContextError):
    pass


def source_key(row: Row) -> SourceKey:
    project, trace, span_id = row.get("project.id", 0), row.get("trace", ""), row.get("span_id")
    if (
        not isinstance(project, int)
        or isinstance(project, bool)
        or not isinstance(trace, str)
        or not isinstance(span_id, str)
    ):
        raise TranscriptContextError("Invalid transcript source identity")
    return project, trace, span_id


def source_time(row: Row, stream: Stream) -> float:
    value = row.get("precise.start_ts" if stream == "start" else "precise.finish_ts")
    if not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value):
        raise TranscriptContextError("Invalid transcript source timestamp")
    return value


def qualified_id(key: SourceKey) -> str:
    project, trace, span_id = key
    return f"{project}:{trace}:{span_id}"


@dataclass
class TranscriptContext:
    rows: dict[SourceKey, Row] = dataclass_field(default_factory=dict, kw_only=True, repr=False)

    def scope(self, row: Row) -> SourceKey:
        project, trace, _ = source_key(row)
        parent_id = row.get("parent_span")
        visited: set[SourceKey] = set()
        while isinstance(parent_id, str) and parent_id:
            key = project, trace, parent_id
            if key in visited or key not in self.rows:
                break
            visited.add(key)
            parent = self.rows[key]
            if _operation_type(parent) == "agent":
                return key
            parent_id = parent.get("parent_span")
        return project, "", ""


def prepare_transcript_spans(context: TranscriptContext) -> list[TranscriptSpan]:
    projected = []
    for key, row in sorted(context.rows.items()):
        if source_time(row, "end") < source_time(row, "start"):
            raise TranscriptContextError("Cannot paginate a span ending before its start")
        parent = row.get("parent_span")
        projected.append(
            {
                **row,
                "span_id": qualified_id(key),
                "parent_span": qualified_id((key[0], key[1], parent))
                if isinstance(parent, str) and parent
                else None,
            }
        )
    return enrich_agent_messages(build_conversation_spans(projected))


@dataclass(frozen=True, slots=True)
class TranscriptEvent:
    key: EventKey
    source: SourceKey
    stream: Stream
    message: TranscriptMessageResponse = dataclass_field(repr=False)


def normalize_events(context: TranscriptContext) -> list[TranscriptEvent]:
    """Normalize a complete source set or a dependency-closed page window."""
    raw_by_id = {qualified_id(key): row for key, row in context.rows.items()}
    groups = partition_spans_by_type(prepare_transcript_spans(context))
    events: list[TranscriptEvent] = []

    def emit(message: TranscriptMessage, kind: int, stream: Stream) -> None:
        key = source_key(raw_by_id[message.span_id])
        wire = message.to_api()
        wire["nodeId"], wire["traceId"], wire["projectId"] = key[2], key[1], str(key[0])
        events.append(TranscriptEvent((message.timestamp, *key, kind), key, stream, wire))

    history: dict[SourceKey, GenerationCapture] = {}
    generations = sorted(
        groups.generations,
        key=lambda span: (span.end_timestamp, source_key(raw_by_id[span.span_id])),
    )
    placeholders = (FILTERED, EMPTY_TEXT_CONTENT, NOT_REPORTED)
    for span in generations:
        scope = context.scope(raw_by_id[span.span_id])
        capture = capture_generation(span)
        previous = history.get(scope)
        history[scope] = capture
        user = _blank_to_null(parse_user_content(span))
        output = parse_assistant_content(span)
        assistant, reasoning = _blank_to_null(output.content), _blank_to_null(output.reasoning)
        input_tokens = number_attr(span, "gen_ai.usage.input_tokens") or 0
        output_tokens = number_attr(span, "gen_ai.usage.output_tokens") or 0
        if user is None and input_tokens > 0 and not string_attr(span, "gen_ai.input.messages"):
            user = NOT_REPORTED
        if (
            assistant is None
            and reasoning is None
            and not string_attr(span, "gen_ai.output.messages")
        ):
            if output_tokens > 0 or not user:
                assistant = NOT_REPORTED
        reasoning_tokens = number_attr(span, "gen_ai.usage.reasoning.output_tokens") or 0
        if reasoning is None and reasoning_tokens > 0:
            reasoning = NOT_REPORTED
        if user and (user in placeholders or not is_user_history_continuation(capture, previous)):
            emit(
                TranscriptMessage(
                    id=f"user-{span.span_id}",
                    role="user",
                    content=user,
                    timestamp=span.start_timestamp,
                    span_id=span.span_id,
                    user_email=string_attr(span, "user.email"),
                ),
                0,
                "start",
            )
        if (assistant or reasoning) and (
            assistant in placeholders or not is_duplicate_assistant_message(capture, previous)
        ):
            emit(
                TranscriptMessage(
                    id=f"assistant-{span.span_id}",
                    role="assistant",
                    content=assistant or "",
                    timestamp=span.end_timestamp,
                    span_id=span.span_id,
                    reasoning=reasoning,
                    duration=_duration(span),
                    agent_name=string_attr(span, "gen_ai.agent.name") or None,
                    model_name=string_attr(span, "gen_ai.response.model") or None,
                ),
                1,
                "end",
            )
    for span in groups.tools:
        name = string_attr(span, "gen_ai.tool.name")
        if name:
            emit(
                TranscriptMessage(
                    id=f"tool-{span.span_id}",
                    role="assistant",
                    content="",
                    timestamp=span.end_timestamp,
                    span_id=span.span_id,
                    duration=_duration(span),
                    tool_calls=(
                        ToolCall(
                            name,
                            source_key(raw_by_id[span.span_id])[2],
                            has_error(span),
                            _duration(span),
                        ),
                    ),
                ),
                2,
                "end",
            )
    for converter, group, kind in (
        (embedding_spans_to_messages, groups.embeddings, 3),
        (evaluation_spans_to_messages, groups.evaluations, 4),
        (memory_spans_to_messages, groups.memory, 5),
    ):
        for message in converter(group):
            emit(message, kind, "end")
    return sorted(events, key=lambda event: event.key)


def _operation_type(row: Mapping[str, object]) -> str | None:
    operation = row.get("gen_ai.operation.type")
    if operation:
        return operation if isinstance(operation, str) else None
    name = row.get("span.name")
    if not isinstance(name, str) or not name.startswith("gen_ai."):
        return None
    return {
        "gen_ai.invoke_agent": "agent",
        "gen_ai.create_agent": "agent",
        "gen_ai.execute_tool": "tool",
        "gen_ai.handoff": "handoff",
    }.get(name, "ai_client")


def _timestamp(value: object) -> float:
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) else 0


def build_conversation_spans(rows: Sequence[Mapping[str, object]]) -> list[TranscriptSpan]:
    spans = []
    for row in rows:
        if not (
            row.get("gen_ai.operation.type")
            or any(
                isinstance(value := row.get(field), str) and value.startswith("gen_ai.")
                for field in ("span.op", "span.name")
            )
        ):
            continue
        # Match the current timeline-to-transcript projection and its defaults.
        attributes: dict[str, object] = {
            field: row.get(field) if row.get(field) is not None else ""
            for field in (
                "gen_ai.conversation.id",
                "gen_ai.embeddings.input",
                "gen_ai.input.messages",
                "gen_ai.operation.name",
                "gen_ai.memory.store.id",
                "gen_ai.memory.query.text",
                "gen_ai.memory.record.id",
                "gen_ai.memory.records",
                "gen_ai.output.messages",
                "gen_ai.response.object",
                "gen_ai.request.model",
                "gen_ai.response.model",
                "gen_ai.agent.name",
                "gen_ai.tool.name",
                "gen_ai.tool.call.arguments",
                "gen_ai.tool.call.result",
                "user.email",
                "user.id",
                "user.ip",
                "user.username",
            )
        }
        attributes["gen_ai.operation.type"] = _operation_type(row) or ""
        for field in (
            "gen_ai.memory.record.count",
            "gen_ai.usage.input_tokens",
            "gen_ai.usage.output_tokens",
            "span.status",
        ):
            if field in row:
                attributes[field] = row[field]
        for target, sources in (
            (
                "gen_ai.usage.cache_read.input_tokens",
                ("gen_ai.usage.cache_read.input_tokens", "gen_ai.usage.input_tokens.cached"),
            ),
            (
                "gen_ai.usage.cache_creation.input_tokens",
                (
                    "gen_ai.usage.cache_creation.input_tokens",
                    "gen_ai.usage.input_tokens.cache_write",
                ),
            ),
            (
                "gen_ai.usage.reasoning.output_tokens",
                ("gen_ai.usage.reasoning.output_tokens", "gen_ai.usage.output_tokens.reasoning"),
            ),
            ("gen_ai.usage.total_tokens", ("gen_ai.usage.total_tokens",)),
            ("gen_ai.cost.total_tokens", ("gen_ai.cost.total_tokens",)),
        ):
            attributes[target] = next(
                (row[field] for field in sources if row.get(field) is not None), 0
            )
        span_id = row["span_id"]
        if not isinstance(span_id, str):
            raise ValueError("AI span id must be a string")
        parent_id = row.get("parent_span")
        spans.append(
            TranscriptSpan(
                span_id=span_id,
                attributes=attributes,
                start_timestamp=_timestamp(row.get("precise.start_ts")),
                end_timestamp=_timestamp(row.get("precise.finish_ts")),
                parent_span_id=parent_id if isinstance(parent_id, str) else None,
                has_errors=bool(row.get("errors")),
            )
        )
    by_id = {span.span_id: span for span in spans}
    children: dict[str, list[TranscriptSpan]] = defaultdict(list)
    roots = []
    for span in spans:
        parent_id = span.parent_span_id
        if not parent_id or parent_id not in by_id or parent_id == span.span_id:
            roots.append(span)
        else:
            children[parent_id].append(span)
    for siblings in children.values():
        siblings.sort(key=lambda span: span.start_timestamp)
    stack = list(reversed(sorted(roots, key=lambda span: span.start_timestamp)))
    ordered = []
    visited: set[str] = set()
    while stack:
        span = stack.pop()
        if span.span_id in visited:
            continue
        visited.add(span.span_id)
        ordered.append(span)
        stack.extend(reversed(children.get(span.span_id, [])))
    ordered.extend(span for span in spans if span.span_id not in visited)
    return ordered


def build_transcript(rows: Sequence[Mapping[str, object]]) -> list[TranscriptMessageResponse]:
    context = TranscriptContext(rows={source_key(row): row for row in rows})
    return [event.message for event in normalize_events(context)]
