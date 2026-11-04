from bisect import bisect_left, bisect_right
from collections import defaultdict
from collections.abc import Sequence
from unittest.mock import MagicMock, Mock, patch

import pytest

from sentry.ai_monitoring.transcript.builder import (
    Row,
    SourceKey,
    Stream,
    TranscriptContextError,
    build_transcript,
    source_key,
    source_time,
)
from sentry.ai_monitoring.transcript.models import TranscriptMessageResponse
from sentry.ai_monitoring.transcript.pagination import (
    Context,
    StreamPosition,
    TranscriptPosition,
    TranscriptWorkLimitError,
    paginate_transcript,
)
from sentry.ai_monitoring.transcript.source import ConversationTranscriptSource
from sentry.snuba.spans_rpc import Spans
from sentry.utils import json


def span(span_id: str, start: float, end: float, **attributes: object) -> dict[str, object]:
    return {
        "project.id": 1,
        "trace": "trace-a",
        "span_id": span_id,
        "precise.start_ts": start,
        "precise.finish_ts": end,
        "gen_ai.operation.type": "ai_client",
        "gen_ai.input.messages": json.dumps([{"role": "user", "content": "question"}]),
        "gen_ai.output.messages": json.dumps([{"role": "assistant", "content": "answer"}]),
        **attributes,
    }


class OrderedRows:
    def __init__(self, rows: Sequence[Row], stream: Stream, *, reverse: bool = False) -> None:
        ordered = sorted(
            ((source_time(row, stream), source_key(row), row) for row in rows),
            key=lambda entry: entry[:2],
            reverse=reverse,
        )
        self.rows = tuple(entry[2] for entry in ordered)
        self.times = tuple(-entry[0] if reverse else entry[0] for entry in ordered)


class MemoryStorage:
    """Static storage indexes, shared without retaining any pagination request state."""

    def __init__(self, rows: Sequence[Row]) -> None:
        self.streams: dict[Stream, OrderedRows] = {
            "start": OrderedRows(rows, "start"),
            "end": OrderedRows(rows, "end"),
        }
        self.parents: dict[SourceKey, list[tuple[int, Row]]] = defaultdict(list)
        children: dict[SourceKey, list[Row]] = defaultdict(list)
        projects: dict[int, list[Row]] = defaultdict(list)
        traces: dict[tuple[int, str], list[Row]] = defaultdict(list)
        for index, row in enumerate(rows):
            key = source_key(row)
            project, trace, _ = key
            self.parents[key].append((index, row))
            projects[project].append(row)
            traces[project, trace].append(row)
            parent = row.get("parent_span")
            if isinstance(parent, str):
                children[project, trace, parent].append(row)
        self.children = {key: OrderedRows(group, "start") for key, group in children.items()}
        self.projects = {
            project: OrderedRows(group, "end", reverse=True) for project, group in projects.items()
        }
        self.traces = {
            key: OrderedRows(group, "end", reverse=True) for key, group in traces.items()
        }


class MemorySource:
    def __init__(self, rows: Sequence[Row] | MemoryStorage) -> None:
        self.storage = rows if isinstance(rows, MemoryStorage) else MemoryStorage(rows)
        self.reads = 0
        self.previous_calls = 0
        self.previous_rows = 0
        self.prepared_rows = 0

    def prepare(self, rows: Sequence[Row]) -> Sequence[Row]:
        self.prepared_rows += len(rows)
        return rows

    def scan(self, stream: Stream, position: StreamPosition, limit: int) -> Sequence[Row]:
        ordered = self.storage.streams[stream]
        start = bisect_left(ordered.times, position.timestamp) + position.offset
        rows = ordered.rows[start : start + limit]
        self.reads += len(rows)
        return rows

    def parents(self, keys: Sequence[SourceKey]) -> Sequence[Row]:
        matches = {index: row for key in keys for index, row in self.storage.parents.get(key, ())}
        return [matches[index] for index in sorted(matches)]

    def children(self, agent: Row, offset: int, limit: int) -> Sequence[Row]:
        ordered = self.storage.children.get(source_key(agent))
        return ordered.rows[offset : offset + limit] if ordered else ()

    def previous(
        self, generation: Row, offset: int, limit: int, *, agent: Row | None
    ) -> Sequence[Row]:
        self.previous_calls += 1
        project, trace, _ = source_key(generation)
        ordered = (
            self.storage.projects.get(project)
            if agent is None
            else self.storage.traces.get((project, trace))
        )
        if ordered is None:
            return ()
        start = bisect_left(ordered.times, -source_time(generation, "end")) + offset
        end = (
            len(ordered.rows)
            if agent is None
            else bisect_right(ordered.times, -source_time(agent, "start"))
        )
        rows = ordered.rows[start : min(start + limit, end)]
        self.previous_rows += len(rows)
        return rows


def test_memory_source_indexes_preserve_order_and_scope() -> None:
    first = span("duplicate", 2, 4)
    duplicate = span("duplicate", 2, 4, **{"gen_ai.operation.type": "tool"})
    child = span("child", 2, 4, **{"parent_span": "agent"})
    early = span("early", 1, 2, **{"parent_span": "agent"})
    other_trace = span("other", 1, 4, **{"trace": "trace-b", "parent_span": "agent"})
    other_project = span("other", 1, 4, **{"project.id": 2, "parent_span": "agent"})
    agent = span("agent", 2, 6, **{"gen_ai.operation.type": "agent"})
    late = span("late", 5, 8, **{"parent_span": "agent"})
    storage = MemoryStorage(
        [child, other_project, first, early, duplicate, other_trace, agent, late]
    )
    source = MemorySource(storage)
    generation = span("generation", 2, 4)

    assert source.scan("start", StreamPosition(2, 1), 3) == (child, first, duplicate)
    assert source.scan("end", StreamPosition(4, 1), 3) == (first, duplicate, other_trace)
    assert source.parents([source_key(first), source_key(child), source_key(first)]) == [
        child,
        first,
        duplicate,
    ]
    assert source.children(agent, 1, 1) == (child,)
    assert source.previous(generation, 1, 3, agent=agent) == (duplicate, child, early)
    assert source.previous(generation, 0, 5, agent=None) == (
        other_trace,
        first,
        duplicate,
        child,
        early,
    )
    assert source.reads == 6
    assert source.previous_calls == 2
    assert source.previous_rows == 8

    fresh_source = MemorySource(storage)
    assert fresh_source.reads == 0
    assert fresh_source.previous_calls == 0
    assert fresh_source.previous_rows == 0
    assert fresh_source.prepared_rows == 0


def collect(rows: Sequence[Row], per_page: int) -> list[TranscriptMessageResponse]:
    storage = MemoryStorage(rows)
    position = TranscriptPosition(StreamPosition(0), StreamPosition(0))
    result: list[TranscriptMessageResponse] = []
    for _ in range(len(rows) * 3 + 2):
        # Every request gets a fresh source: no server-side pagination session.
        page = paginate_transcript(MemorySource(storage), position, per_page)
        assert len(page.items) <= per_page
        result.extend(page.items)
        if not page.has_more:
            assert result == build_transcript(rows)
            return result
        assert page.position != position
        position = page.position
    pytest.fail("pagination did not terminate")


def cases() -> list[list[Row]]:
    history = json.dumps(
        [{"role": "user", "content": "question"}, {"role": "assistant", "content": "answer"}]
    )
    return [
        [],
        [span("one", 1, 2)],
        [span("one", 1, 10), span("two", 2, 3), span("three", 4, 5)],
        [span(str(index), 1, 1) for index in range(8)],
        [
            span("one", 1, 2),
            span("two", 3, 4, **{"gen_ai.input.messages": history}),
            span("three", 5, 6),
        ],
        [
            span("one", 1, 2),
            span("tool", 3, 4, **{"gen_ai.operation.type": "tool", "gen_ai.tool.name": "lookup"}),
            span("two", 5, 6),
        ],
        [span("tool", 1, 2, **{"gen_ai.operation.type": "tool", "gen_ai.tool.name": "lookup"})],
        [span("one", 1, 2), span("one", 1, 2, **{"trace": "trace-b"})],
        [
            span(
                "one",
                1,
                2,
                **{
                    "gen_ai.input.messages": "",
                    "gen_ai.output.messages": "",
                    "gen_ai.usage.input_tokens": 10,
                    "gen_ai.usage.output_tokens": 5,
                },
            ),
            span("two", 3, 4),
        ],
        [
            span("agent", 1, 10, **{"gen_ai.operation.type": "agent"}),
            span(
                "one",
                2,
                3,
                **{
                    "parent_span": "agent",
                    "gen_ai.input.messages": "",
                    "gen_ai.output.messages": "",
                },
            ),
            span(
                "two",
                4,
                5,
                **{
                    "parent_span": "agent",
                    "gen_ai.input.messages": "",
                    "gen_ai.output.messages": "",
                },
            ),
        ],
        [
            span("agent", 1, 10, **{"gen_ai.operation.type": "agent"}),
            span("one", 2, 3, **{"parent_span": "agent"}),
            span("root", 4, 5),
            span("two", 6, 7, **{"parent_span": "agent", "gen_ai.input.messages": history}),
        ],
        [span("one", 1, 2, **{"parent_span": "two"}), span("two", 3, 4, **{"parent_span": "one"})],
        [
            span(
                "one",
                1,
                2,
                **{"gen_ai.operation.name": "embeddings", "gen_ai.embeddings.input": "text"},
            ),
            span("two", 2, 3, **{"gen_ai.operation.name": "evaluate"}),
            span("three", 3, 4, **{"gen_ai.operation.name": "memory.get"}),
        ],
    ]


@pytest.mark.parametrize("rows", cases())
@pytest.mark.parametrize("per_page", [1, 2, 3, 25])
def test_stitched_pages_equal_complete_event_contract(rows: list[Row], per_page: int) -> None:
    assert collect(rows, per_page) == build_transcript(rows)


def test_repeated_responses_and_genuine_repeated_questions_are_retained() -> None:
    messages = collect([span("one", 1, 2), span("two", 3, 4)], 1)
    assert [message["content"] for message in messages] == [
        "question",
        "answer",
        "question",
        "answer",
    ]


def test_only_adjacent_matching_history_is_suppressed() -> None:
    history = json.dumps(
        [{"role": "user", "content": "question"}, {"role": "assistant", "content": "answer"}]
    )
    messages = collect(
        [
            span("one", 1, 2),
            span("two", 3, 4, **{"gen_ai.input.messages": history}),
            span("three", 5, 6, **{"gen_ai.input.messages": "different"}),
            span("four", 7, 8, **{"gen_ai.input.messages": history}),
        ],
        1,
    )
    assert [message["nodeId"] for message in messages if message["role"] == "user"] == [
        "one",
        "three",
        "four",
    ]


def test_terminal_tool_has_its_own_stable_source_reference() -> None:
    messages = collect(
        [
            span("one", 1, 2),
            span(
                "tool",
                3,
                4,
                **{
                    "gen_ai.operation.type": "tool",
                    "gen_ai.tool.name": "lookup",
                    "span.status": "internal_error",
                },
            ),
        ],
        1,
    )
    assert messages[-1]["nodeId"] == "tool"
    assert messages[-1].get("toolCalls") == [
        {"name": "lookup", "nodeId": "tool", "hasError": True, "duration": 1}
    ]


def test_large_conversation_does_not_reconstruct_prefix() -> None:
    rows = [span(f"{index:05d}", index * 2 + 1, index * 2 + 2) for index in range(1000)]
    source = MemorySource(rows)
    position = TranscriptPosition(StreamPosition(1801), StreamPosition(1801))
    page = paginate_transcript(source, position, 10, budget=1000)
    assert len(page.items) == 10
    assert page.items[0]["nodeId"] == "00900"
    assert page.has_more
    assert page.context_rows < 250


def test_context_budget_is_explicit_not_partial_success() -> None:
    with pytest.raises(TranscriptWorkLimitError, match="server limit"):
        paginate_transcript(
            MemorySource([span("one", 1, 2), span("two", 3, 4)]),
            TranscriptPosition(StreamPosition(0), StreamPosition(0)),
            1,
            budget=1,
        )


@pytest.mark.parametrize("timestamp", [float("nan"), float("inf"), "invalid"])
def test_invalid_source_timestamp_is_rejected(timestamp: object) -> None:
    with pytest.raises(TranscriptContextError, match="timestamp"):
        collect([span("one", 1, 2, **{"precise.finish_ts": timestamp})], 1)


def tool_continuation_spans() -> list[Row]:
    history: list[dict[str, object]] = [
        {"role": "system", "content": "Be helpful"},
        {"role": "user", "content": "Generate a sample report"},
    ]
    rows: list[Row] = [
        span(
            "agent",
            0,
            11,
            **{
                "gen_ai.operation.type": "agent",
                "gen_ai.input.messages": "",
                "gen_ai.output.messages": "",
            },
        )
    ]
    for name, start, text in (("one", 1, "Inspecting records"), ("two", 5, "Checking totals")):
        call: dict[str, object] = {"id": f"call-{name}", "name": "lookup", "arguments": {}}
        rows.extend(
            [
                span(
                    name,
                    start,
                    start + 1,
                    **{
                        "parent_span": "agent",
                        "gen_ai.input.messages": json.dumps(history),
                        "gen_ai.output.messages": json.dumps(
                            [
                                {
                                    "role": "assistant",
                                    "parts": [
                                        {"type": "text", "text": text},
                                        {"type": "tool_call", **call},
                                    ],
                                }
                            ]
                        ),
                    },
                ),
                span(
                    f"tool-{name}",
                    start + 2,
                    start + 3,
                    **{
                        "parent_span": "agent",
                        "gen_ai.operation.type": "tool",
                        "gen_ai.tool.name": "lookup",
                    },
                ),
            ]
        )
        history.extend(
            [
                {"role": "assistant", "content": text, "tool_calls": [call]},
                {"role": "tool", "content": "result", "tool_call_id": call["id"]},
            ]
        )
    rows.append(
        span(
            "three",
            9,
            10,
            **{
                "parent_span": "agent",
                "gen_ai.input.messages": json.dumps(history),
                "gen_ai.output.messages": json.dumps(
                    [{"role": "assistant", "content": "Report complete"}]
                ),
            },
        )
    )
    return rows


@pytest.mark.parametrize("per_page", [1, 100])
def test_tool_continuations_emit_the_user_turn_once(per_page: int) -> None:
    messages = collect(tool_continuation_spans(), per_page)
    assert [(message["role"], message["content"], message["nodeId"]) for message in messages] == [
        ("user", "Generate a sample report", "one"),
        ("assistant", "Inspecting records", "one"),
        ("assistant", "", "tool-one"),
        ("assistant", "Checking totals", "two"),
        ("assistant", "", "tool-two"),
        ("assistant", "Report complete", "three"),
    ]


def test_genuinely_repeated_question_after_tool_calls_is_retained() -> None:
    rows = tool_continuation_spans()
    final = dict(rows[-1])
    raw = final["gen_ai.input.messages"]
    assert isinstance(raw, str)
    history = json.loads(raw)
    final["gen_ai.input.messages"] = json.dumps(
        [*history, {"role": "user", "content": "Generate a sample report"}]
    )
    rows[-1] = final
    messages = collect(rows, 1)
    assert [message["nodeId"] for message in messages if message["role"] == "user"] == [
        "one",
        "three",
    ]


def test_input_history_growth_proves_continuation_without_captured_output() -> None:
    messages = collect(
        [
            span("one", 1, 2, **{"gen_ai.output.messages": ""}),
            span(
                "two",
                5,
                6,
                **{
                    "gen_ai.input.messages": json.dumps(
                        [
                            {"role": "user", "content": "question"},
                            {
                                "role": "assistant",
                                "tool_calls": [{"id": "call-1", "name": "lookup"}],
                            },
                            {"role": "tool", "content": "result", "tool_call_id": "call-1"},
                        ]
                    )
                },
            ),
        ],
        1,
    )
    assert [(message["role"], message["content"]) for message in messages] == [
        ("user", "question"),
        ("assistant", "answer"),
    ]


@pytest.mark.parametrize("per_page", [1, 2, 3])
def test_same_text_and_counts_do_not_prove_history_continuation(per_page: int) -> None:
    first = [
        {"role": "system", "content": "first context"},
        {"role": "user", "content": "question"},
    ]
    second = [
        {"role": "system", "content": "different context"},
        {"role": "user", "content": "question"},
    ]
    messages = collect(
        [
            span("one", 1, 2, **{"gen_ai.input.messages": json.dumps(first)}),
            span("two", 3, 4, **{"gen_ai.input.messages": json.dumps(second)}),
        ],
        per_page,
    )
    assert [message["nodeId"] for message in messages if message["role"] == "user"] == [
        "one",
        "two",
    ]


@pytest.mark.parametrize("per_page", [1, 2, 3])
def test_identical_truncated_history_is_ambiguous(per_page: int) -> None:
    history = json.dumps(
        [
            {"role": "user", "content": "question"},
            {"role": "assistant", "content": "answer"},
            {"role": "user", "content": "question"},
        ]
    )
    messages = collect(
        [
            span("one", 1, 2, **{"gen_ai.input.messages": history}),
            span("two", 3, 4, **{"gen_ai.input.messages": history}),
        ],
        per_page,
    )
    assert [message["nodeId"] for message in messages if message["role"] == "user"] == [
        "one",
        "two",
    ]


@pytest.mark.parametrize("per_page", [1, 2, 3])
def test_new_user_after_verified_history_is_not_suppressed(per_page: int) -> None:
    history = json.dumps(
        [
            {"role": "user", "content": "question"},
            {"role": "assistant", "content": "answer"},
            {"role": "user", "content": "question"},
        ]
    )
    messages = collect(
        [span("one", 1, 2), span("two", 3, 4, **{"gen_ai.input.messages": history})], per_page
    )
    assert [message["nodeId"] for message in messages if message["role"] == "user"] == [
        "one",
        "two",
    ]


@pytest.mark.parametrize("per_page", [1, 2, 3])
def test_history_continuation_is_agent_and_project_scoped(per_page: int) -> None:
    history = json.dumps(
        [{"role": "user", "content": "question"}, {"role": "assistant", "content": "answer"}]
    )
    messages = collect(
        [
            span("agent-a", 0, 10, **{"gen_ai.operation.type": "agent"}),
            span("agent-b", 0, 10, **{"gen_ai.operation.type": "agent"}),
            span("one", 1, 2, **{"parent_span": "agent-a"}),
            span("two", 3, 4, **{"parent_span": "agent-b", "gen_ai.input.messages": history}),
            span("three", 5, 6, **{"project.id": 2, "gen_ai.input.messages": history}),
        ],
        per_page,
    )
    assert [message["nodeId"] for message in messages if message["role"] == "user"] == [
        "one",
        "two",
        "three",
    ]


@pytest.mark.parametrize("per_page", [1, 2, 3])
def test_matching_message_ids_and_payloads_prove_duplicate_messages(per_page: int) -> None:
    attributes = {
        "gen_ai.input.messages": json.dumps(
            [{"role": "user", "id": "user-message", "content": "question"}]
        ),
        "gen_ai.output.messages": json.dumps(
            [{"role": "assistant", "id": "response-message", "content": "answer"}]
        ),
    }
    messages = collect([span("one", 1, 2, **attributes), span("two", 3, 4, **attributes)], per_page)
    assert [(message["role"], message["nodeId"]) for message in messages] == [
        ("user", "one"),
        ("assistant", "one"),
    ]


@pytest.mark.parametrize("per_page", [1, 2, 3])
def test_reused_response_id_does_not_collapse_a_new_user_turn(per_page: int) -> None:
    response = json.dumps([{"role": "assistant", "id": "response-message", "content": "answer"}])
    messages = collect(
        [
            span(
                "one",
                1,
                2,
                **{
                    "gen_ai.input.messages": json.dumps(
                        [{"role": "user", "id": "first-user", "content": "question"}]
                    ),
                    "gen_ai.output.messages": response,
                },
            ),
            span(
                "two",
                3,
                4,
                **{
                    "gen_ai.input.messages": json.dumps(
                        [{"role": "user", "id": "second-user", "content": "question"}]
                    ),
                    "gen_ai.output.messages": response,
                },
            ),
        ],
        per_page,
    )
    assert [message["nodeId"] for message in messages] == ["one", "one", "two", "two"]


@pytest.mark.parametrize("per_page", [1, 2, 3])
def test_changed_payload_with_same_id_is_not_discarded(per_page: int) -> None:
    user = json.dumps([{"role": "user", "id": "user-message", "content": "question"}])
    messages = collect(
        [
            span(
                "one",
                1,
                2,
                **{
                    "gen_ai.input.messages": user,
                    "gen_ai.output.messages": json.dumps(
                        [{"role": "assistant", "id": "response-message", "content": "first answer"}]
                    ),
                },
            ),
            span(
                "two",
                3,
                4,
                **{
                    "gen_ai.input.messages": user,
                    "gen_ai.output.messages": json.dumps(
                        [
                            {
                                "role": "assistant",
                                "id": "response-message",
                                "content": "corrected answer",
                            }
                        ]
                    ),
                },
            ),
        ],
        per_page,
    )
    assert [message["content"] for message in messages] == [
        "question",
        "first answer",
        "corrected answer",
    ]


@pytest.mark.parametrize("per_page", [1, 2, 3])
def test_concurrent_generations_do_not_prove_history_continuity(per_page: int) -> None:
    history = json.dumps(
        [{"role": "user", "content": "question"}, {"role": "assistant", "content": "answer"}]
    )
    messages = collect(
        [span("one", 1, 5), span("two", 2, 6, **{"gen_ai.input.messages": history})], per_page
    )
    assert [message["nodeId"] for message in messages if message["role"] == "user"] == [
        "one",
        "two",
    ]


@pytest.mark.parametrize("per_page", [1, 2, 3])
def test_duplicate_source_delivery_emits_one_event(per_page: int) -> None:
    tool = span("tool", 1, 2, **{"gen_ai.operation.type": "tool", "gen_ai.tool.name": "lookup"})
    assert len(collect([tool, dict(tool)], per_page)) == 1


@pytest.mark.parametrize("per_page", [1, 2, 3])
def test_identical_tools_with_distinct_source_ids_are_retained(per_page: int) -> None:
    attributes = {"gen_ai.operation.type": "tool", "gen_ai.tool.name": "lookup"}
    messages = collect(
        [span("tool-a", 1, 2, **attributes), span("tool-b", 3, 4, **attributes)], per_page
    )
    assert [message["nodeId"] for message in messages] == ["tool-a", "tool-b"]


@pytest.mark.parametrize("per_page", [1, 2, 3])
@pytest.mark.parametrize(
    "usage_field",
    ["gen_ai.usage.reasoning.output_tokens", "gen_ai.usage.output_tokens.reasoning"],
)
def test_uncaptured_reasoning_preserves_assistant_event(per_page: int, usage_field: str) -> None:
    messages = collect(
        [
            span(
                "one",
                1,
                2,
                **{
                    "gen_ai.input.messages": "",
                    "gen_ai.output.messages": "",
                    "gen_ai.usage.input_tokens": 10,
                    usage_field: 5,
                },
            )
        ],
        per_page,
    )
    assert [(message["role"], message["content"]) for message in messages] == [
        ("user", "<not reported>"),
        ("assistant", ""),
    ]
    assert messages[1].get("reasoning") == "<not reported>"


@pytest.mark.parametrize("per_page", [1, 2, 3])
@pytest.mark.parametrize(
    ("reasoning_parts", "tokens", "expected"),
    [
        ([], 5, "<not reported>"),
        ([{"type": "reasoning", "text": "captured reasoning"}], 5, "captured reasoning"),
        ([], 0, None),
        ([], -1, None),
        ([], None, None),
    ],
)
def test_reasoning_placeholder_preserves_captured_content(
    per_page: int, reasoning_parts: list[dict[str, str]], tokens: int | None, expected: str | None
) -> None:
    messages = collect(
        [
            span(
                "one",
                1,
                2,
                **{
                    "gen_ai.output.messages": json.dumps(
                        [
                            {
                                "role": "assistant",
                                "parts": [{"type": "text", "text": "answer"}, *reasoning_parts],
                            }
                        ]
                    ),
                    "gen_ai.usage.reasoning.output_tokens": tokens,
                },
            )
        ],
        per_page,
    )
    assert messages[1]["content"] == "answer"
    assert messages[1].get("reasoning") == expected


def test_context_budget_and_preparation_count_unique_rows() -> None:
    row = span("one", 1, 2)
    source = MemorySource([row])
    context = Context(source, budget=1)
    context.add([row, dict(row)])
    context.add([dict(row)])
    assert context.work == 1
    assert len(context.rows) == 1
    assert source.prepared_rows == 1


@pytest.mark.parametrize(
    "per_page",
    [
        # Paging 600 messages one at a time takes ~60s in CI, which would trip the
        # global --fail-slow=60s and get rerun.
        pytest.param(1, marks=pytest.mark.fail_slow("90s")),
        100,
    ],
)
@pytest.mark.parametrize("separate_traces", [False, True])
def test_many_agents_do_not_scan_conversation_history(per_page: int, separate_traces: bool) -> None:
    rows = []
    for index in range(300):
        trace = f"trace-{index}" if separate_traces else "trace-a"
        rows.extend(
            [
                span(
                    f"agent-{index}",
                    index * 4,
                    index * 4 + 3,
                    **{
                        "trace": trace,
                        "gen_ai.operation.type": "agent",
                        "gen_ai.input.messages": "",
                        "gen_ai.output.messages": "",
                    },
                ),
                span(
                    f"generation-{index}",
                    index * 4 + 1,
                    index * 4 + 2,
                    **{
                        "trace": trace,
                        "parent_span": f"agent-{index}",
                        "gen_ai.input.messages": json.dumps(
                            [
                                {"role": "system", "content": "Be helpful"},
                                {"role": "user", "content": "question"},
                            ]
                        ),
                    },
                ),
            ]
        )
    storage = MemoryStorage(rows)
    position = TranscriptPosition(StreamPosition(0), StreamPosition(0))
    messages: list[TranscriptMessageResponse] = []
    has_more = True
    for _ in range(600 // per_page):
        source = MemorySource(storage)
        page = paginate_transcript(source, position, per_page, budget=500)
        assert source.previous_calls <= per_page // 2 + 51
        assert source.previous_rows <= per_page + 102
        assert source.prepared_rows == page.context_rows
        messages.extend(page.items)
        position = page.position
        has_more = page.has_more
    assert has_more is False
    assert messages == build_transcript(rows)
    assert len(messages) == 600


def test_agent_predecessor_keeps_exact_scope_for_nested_agents() -> None:
    rows = [
        span("outer", 0, 20, **{"gen_ai.operation.type": "agent"}),
        span("previous", 1, 2, **{"parent_span": "outer"}),
        span("inner", 5, 10, **{"parent_span": "outer", "gen_ai.operation.type": "agent"}),
        span("nested", 6, 7, **{"parent_span": "inner"}),
        span(
            "current",
            11,
            12,
            **{
                "parent_span": "outer",
                "gen_ai.input.messages": json.dumps(
                    [
                        {"role": "user", "content": "question"},
                        {"role": "assistant", "content": "answer"},
                    ]
                ),
            },
        ),
    ]
    source = MemorySource(rows)
    page = paginate_transcript(
        source, TranscriptPosition(StreamPosition(11), StreamPosition(11)), 10
    )
    assert source.previous_calls == 1
    assert [(message["role"], message["nodeId"]) for message in page.items] == [
        ("assistant", "current")
    ]


def test_annotations_run_once_and_update_emitted_error_flags() -> None:
    tool = span("tool", 1, 2, **{"gen_ai.operation.type": "tool", "gen_ai.tool.name": "lookup"})

    def annotate(rows: list[dict[str, object]]) -> None:
        rows[0]["errors"] = [{"issue_id": 1}]

    callback = Mock(side_effect=annotate)
    page = paginate_transcript(
        MemorySource([tool]),
        TranscriptPosition(StreamPosition(0), StreamPosition(0)),
        1,
        annotate=callback,
    )
    callback.assert_called_once()
    assert len(callback.call_args.args[0]) == 1
    assert page.items[0].get("toolCalls") == [
        {"name": "lookup", "nodeId": "tool", "hasError": True, "duration": 1}
    ]


def test_storage_predecessor_query_is_bounded_to_agent_trace_and_start() -> None:
    source = ConversationTranscriptSource(MagicMock(), "conversation", [], Mock(), 5)
    agent = span("agent", 20, 40, **{"gen_ai.operation.type": "agent"})
    generation = span("generation", 30, 35)
    with patch.object(Spans, "run_table_query", return_value={"data": []}) as query:
        source.previous(generation, 0, 10, agent=agent)
    assert query.call_args.kwargs["query_string"] == (
        '(gen_ai.conversation.id:"conversation") '
        '(project.id:1 precise.finish_ts:<=35.000000000 trace:"trace-a" '
        "precise.finish_ts:>=20.000000000)"
    )
    assert query.call_args.kwargs["limit"] == 10


def test_root_predecessor_query_preserves_cross_trace_scope() -> None:
    source = ConversationTranscriptSource(MagicMock(), "conversation", [], Mock(), 5)
    with patch.object(Spans, "run_table_query", return_value={"data": []}) as query:
        source.previous(span("generation", 30, 35), 0, 10, agent=None)
    assert query.call_args.kwargs["query_string"] == (
        '(gen_ai.conversation.id:"conversation") (project.id:1 precise.finish_ts:<=35.000000000)'
    )


def test_storage_reads_do_not_prepare_duplicate_stream_rows() -> None:
    prepare = Mock()
    source = ConversationTranscriptSource(MagicMock(), "conversation", [], prepare, 5)
    row = span("generation", 1, 2)
    with patch.object(Spans, "run_table_query", return_value={"data": [row]}) as query:
        page = paginate_transcript(
            source, TranscriptPosition(StreamPosition(0), StreamPosition(0)), 10
        )
    assert query.call_count == 2
    prepare.assert_called_once()
    assert len(prepare.call_args.args[0]) == 1
    assert len(page.items) == 2


@pytest.mark.parametrize("per_page", [1, 2, 3])
@pytest.mark.parametrize(
    ("output", "expected_content", "expected_reasoning"),
    [
        ([{"role": "assistant", "content": {"answer": 42}}], {"answer": 42}, None),
        (
            [{"role": "assistant", "parts": [{"type": "object", "data": {"answer": 42}}]}],
            {"type": "object", "data": {"answer": 42}},
            None,
        ),
        (
            [
                {
                    "role": "assistant",
                    "parts": [
                        {"type": "reasoning", "text": "considering"},
                        {"type": "object", "data": {"answer": 42}},
                    ],
                }
            ],
            {"type": "object", "data": {"answer": 42}},
            "considering",
        ),
    ],
)
def test_structured_assistant_output_survives_pagination(
    per_page: int,
    output: list[dict[str, object]],
    expected_content: dict[str, object],
    expected_reasoning: str | None,
) -> None:
    messages = collect(
        [span("one", 1, 2, **{"gen_ai.output.messages": json.dumps(output)})], per_page
    )
    assert len(messages) == 2
    assert messages[1]["role"] == "assistant"
    assert json.loads(messages[1]["content"]) == expected_content
    assert messages[1].get("reasoning") == expected_reasoning


@pytest.mark.parametrize("per_page", [1, 2, 3])
@pytest.mark.parametrize(
    ("field", "role", "content"),
    [
        ("gen_ai.input.messages", "user", "question"),
        ("gen_ai.output.messages", "assistant", "answer"),
    ],
)
def test_deep_metadata_disables_duplicate_detection_without_losing_messages(
    per_page: int, field: str, role: str, content: str
) -> None:
    raw = (
        f'[{{"role":{json.dumps(role)},"id":"message",'
        f'"content":{json.dumps(content)},"metadata":' + "[" * 600 + "0" + "]" * 600 + "}]"
    )
    assert json.loads(raw)[0]["content"] == content
    messages = collect(
        [
            span("one", 1, 2, **{field: raw}),
            span("two", 3, 4, **{field: raw}),
        ],
        per_page,
    )
    assert [(message["role"], message["content"]) for message in messages] == [
        ("user", "question"),
        ("assistant", "answer"),
        ("user", "question"),
        ("assistant", "answer"),
    ]
