"""Retrieve dependency-closed windows for the canonical transcript normalizer.

Cursors carry source positions, not deduplication history. Pagination determines
which events belong to a page; transcript.builder owns their semantics.
"""

from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from typing import Any, Protocol

from sentry.ai_monitoring.transcript.builder import (
    EventKey,
    Row,
    SourceKey,
    Stream,
    TranscriptContext,
    TranscriptContextError,
    TranscriptEvent,
    build_conversation_spans,
    normalize_events,
    partition_spans_by_type,
    prepare_transcript_spans,
    qualified_id,
    source_key,
    source_time,
)
from sentry.ai_monitoring.transcript.deduplication import capture_generation
from sentry.ai_monitoring.transcript.models import TranscriptMessageResponse

BATCH_SIZE = 100
MAX_CONTEXT_ROWS = 10_000


class TranscriptWorkLimitError(TranscriptContextError):
    pass


@dataclass(frozen=True, slots=True)
class StreamPosition:
    timestamp: float
    offset: int = 0


@dataclass(frozen=True, slots=True)
class TranscriptPosition:
    start: StreamPosition
    end: StreamPosition
    last_event: EventKey | None = None


class TranscriptSource(Protocol):
    def scan(self, stream: Stream, position: StreamPosition, limit: int) -> Sequence[Row]: ...
    def parents(self, keys: Sequence[SourceKey]) -> Sequence[Row]: ...
    def children(self, agent: Row, offset: int, limit: int) -> Sequence[Row]: ...
    def previous(
        self, generation: Row, offset: int, limit: int, *, agent: Row | None
    ) -> Sequence[Row]: ...
    def prepare(self, rows: Sequence[Row]) -> Sequence[Row]: ...


@dataclass(frozen=True, slots=True)
class TranscriptPage:
    items: tuple[TranscriptMessageResponse, ...] = field(repr=False)
    position: TranscriptPosition
    has_more: bool
    source_rows: tuple[Row, ...] = field(repr=False)
    context_rows: int


@dataclass
class Context(TranscriptContext):
    source: TranscriptSource
    budget: int = MAX_CONTEXT_ROWS
    missing: set[SourceKey] = field(default_factory=set)
    expanded_agents: set[SourceKey] = field(default_factory=set)
    work: int = 0
    previous_checked: set[SourceKey] = field(default_factory=set)

    def add(self, rows: Sequence[Row]) -> None:
        new_rows = {source_key(row): row for row in rows if source_key(row) not in self.rows}
        self.work += len(new_rows)
        if self.work > self.budget:
            raise TranscriptWorkLimitError(
                "Transcript context exceeds the per-request server limit"
            )
        for row in self.source.prepare(list(new_rows.values())):
            if source_time(row, "end") < source_time(row, "start"):
                raise TranscriptContextError("Cannot paginate a span ending before its start")
            self.rows[source_key(row)] = row

    def close_parents(self) -> None:
        while True:
            needed: set[SourceKey] = set()
            for row in self.rows.values():
                parent = row.get("parent_span")
                if isinstance(parent, str) and parent:
                    project, trace, _ = source_key(row)
                    key = project, trace, parent
                    if key not in self.rows and key not in self.missing:
                        needed.add(key)
            if not needed:
                break
            self.add(self.source.parents(sorted(needed)))
            self.missing.update(needed - self.rows.keys())

    def enrich_context(self, owned: Sequence[Row], end_rows: Sequence[Row]) -> None:
        self.close_parents()
        required_agents = {self.scope(row) for row in owned if _is_generation(row)}
        for agent_key in sorted(required_agents):
            agent = self.rows.get(agent_key)
            if agent is None or agent_key in self.expanded_agents:
                continue
            self.expanded_agents.add(agent_key)
            if (
                not agent.get("gen_ai.output.messages")
                or agent.get("gen_ai.output.messages") == "[Filtered]"
            ):
                continue
            if any(
                (source_key(row)[:2], row.get("parent_span")) == (agent_key[:2], agent_key[2])
                and _is_generation(row)
                and any(
                    row.get(name)
                    for name in (
                        "gen_ai.input.messages",
                        "gen_ai.request.messages",
                        "gen_ai.output.messages",
                        "gen_ai.response.text",
                    )
                )
                for row in self.rows.values()
            ):
                continue
            offset = 0
            while True:
                children = self.source.children(agent, offset, BATCH_SIZE)
                self.add(children)
                offset += len(children)
                if len(children) < BATCH_SIZE:
                    break
        self.close_parents()
        enriched = {span.span_id: span for span in prepare_transcript_spans(self)}
        for generation in owned:
            key = source_key(generation)
            if key in self.previous_checked or not _is_generation(generation):
                continue
            self.previous_checked.add(key)
            if not capture_generation(enriched[qualified_id(key)]).needs_previous:
                continue
            target = source_time(generation, "end"), *key
            scope = self.scope(generation)
            agent = self.rows.get(scope)
            # The end stream is contiguous. An in-stream predecessor is exact;
            # only its left boundary requires an additional storage lookup.
            if (
                end_rows
                and target <= (source_time(end_rows[-1], "end"), *source_key(end_rows[-1]))
                and any(
                    (source_time(row, "end"), *source_key(row)) < target
                    and _is_generation(row)
                    and self.scope(row) == scope
                    for row in end_rows
                )
            ):
                continue
            offset = 0
            while True:
                candidates = self.source.previous(generation, offset, 10, agent=agent)
                self.add(candidates)
                self.close_parents()
                candidates = [self.rows[source_key(row)] for row in candidates]
                match = next(
                    (
                        row
                        for row in candidates
                        if (source_time(row, "end"), *source_key(row)) < target
                        and _is_generation(row)
                        and self.scope(row) == scope
                    ),
                    None,
                )
                if match is not None or len(candidates) < 10:
                    break
                offset += len(candidates)


def _is_generation(row: Row) -> bool:
    return bool(partition_spans_by_type(build_conversation_spans([row])).generations)


@dataclass
class _Buffer:
    stream: Stream
    position: StreamPosition
    rows: list[Row] = field(default_factory=list, repr=False)
    exhausted: bool = False

    def fetch(self, context: Context) -> None:
        position = self.position
        if self.rows:
            last_time = source_time(self.rows[-1], self.stream)
            same_time = sum(source_time(row, self.stream) == last_time for row in self.rows)
            position = StreamPosition(
                last_time,
                same_time + (self.position.offset if last_time == self.position.timestamp else 0),
            )
        batch = list(context.source.scan(self.stream, position, BATCH_SIZE))
        context.add(batch)
        self.rows.extend(context.rows[source_key(row)] for row in batch)
        self.exhausted = len(batch) < BATCH_SIZE

    def frontier(self) -> EventKey | None:
        if self.exhausted:
            return None
        row = self.rows[-1]
        return source_time(row, self.stream), *source_key(row), 0 if self.stream == "start" else 1

    def advance(self, events: Sequence[TranscriptEvent], last: EventKey | None) -> StreamPosition:
        by_source = {event.source: event.key for event in events if event.stream == self.stream}
        consumed: list[Row] = []
        for row in self.rows:
            event_key = by_source.get(source_key(row))
            if event_key is not None and (last is None or event_key > last):
                break
            consumed.append(row)
        if not consumed:
            return self.position
        timestamp = source_time(consumed[-1], self.stream)
        offset = sum(source_time(row, self.stream) == timestamp for row in consumed)
        if timestamp == self.position.timestamp:
            offset += self.position.offset
        return StreamPosition(timestamp, offset)


def paginate_transcript(
    source: TranscriptSource,
    position: TranscriptPosition,
    limit: int,
    *,
    budget: int = MAX_CONTEXT_ROWS,
    annotate: Callable[[list[dict[str, Any]]], None] | None = None,
) -> TranscriptPage:
    if not 1 <= limit <= 1000:
        raise ValueError("Transcript page size must be between 1 and 1000")
    context = Context(source, budget)
    buffers = [_Buffer("start", position.start), _Buffer("end", position.end)]
    for buffer in buffers:
        buffer.fetch(context)
    while True:
        owned = {source_key(row): row for buffer in buffers for row in buffer.rows}
        context.enrich_context(list(owned.values()), buffers[1].rows)
        events = normalize_events(context)
        frontiers = [frontier for buffer in buffers if (frontier := buffer.frontier()) is not None]
        frontier = min(frontiers) if frontiers else None
        owners = {buffer.stream: {source_key(row) for row in buffer.rows} for buffer in buffers}
        selected = [
            event
            for event in events
            if event.source in owners[event.stream]
            and (position.last_event is None or event.key > position.last_event)
            and (frontier is None or event.key < frontier)
        ]
        if len(selected) > limit or not frontiers:
            break
        next(buffer for buffer in buffers if buffer.frontier() == frontier).fetch(context)
    page_events = selected[:limit]
    last = page_events[-1].key if page_events else position.last_event
    next_position = TranscriptPosition(
        buffers[0].advance(events, last), buffers[1].advance(events, last), last
    )
    has_more = len(selected) > limit or any(not buffer.exhausted for buffer in buffers)
    emitted = {event.source for event in page_events}
    source_rows = [dict(context.rows[key]) for key in sorted(emitted)]
    if annotate is not None and source_rows:
        annotate(source_rows)
        context.rows.update((source_key(row), row) for row in source_rows)
        # Issue annotations affect tool/embedding error flags, not event ownership or ordering.
        page_keys = {event.key for event in page_events}
        page_events = [event for event in normalize_events(context) if event.key in page_keys]
    return TranscriptPage(
        tuple(event.message for event in page_events),
        next_position,
        has_more,
        tuple(source_rows),
        len(context.rows),
    )
