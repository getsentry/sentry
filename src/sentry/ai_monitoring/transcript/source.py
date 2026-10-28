"""Authorized, conversation-scoped storage reads for transcript pages."""

from collections.abc import Callable, Sequence
from typing import Any

from sentry.ai_monitoring.transcript.builder import (
    Row,
    SourceKey,
    Stream,
    source_key,
    source_time,
)
from sentry.ai_monitoring.transcript.pagination import (
    MAX_CONTEXT_ROWS,
    StreamPosition,
    TranscriptWorkLimitError,
)
from sentry.search.eap.occurrences.query_utils import build_escaped_term_filter
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans


class ConversationTranscriptSource:
    def __init__(
        self,
        params: SnubaParams,
        conversation_id: str,
        columns: Sequence[str],
        prepare: Callable[[list[dict[str, Any]]], None],
        parent_depth: int,
    ) -> None:
        self.params = params
        self.conversation_id = conversation_id
        self.columns = columns
        self._prepare = prepare
        self.parent_depth = parent_depth
        self.rows_read = 0
        self.child_cache: dict[SourceKey, Sequence[Row]] = {}

    def query(
        self,
        condition: str,
        orderby: list[str],
        offset: int,
        limit: int,
        *,
        conversation_only: bool = True,
    ) -> list[dict[str, Any]]:
        conversation = build_escaped_term_filter("gen_ai.conversation.id", [self.conversation_id])
        query_string = f"({conversation}) ({condition})" if conversation_only else condition
        result = Spans.run_table_query(
            params=self.params,
            query_string=query_string,
            selected_columns=list(self.columns),
            orderby=orderby,
            offset=offset,
            limit=limit,
            referrer=Referrer.API_AI_CONVERSATION_DETAILS.value,
            config=SearchResolverConfig(auto_fields=False),
            sampling_mode="HIGHEST_ACCURACY",
        )
        rows = result.get("data", [])
        self.rows_read += len(rows)
        if self.rows_read > MAX_CONTEXT_ROWS:
            raise TranscriptWorkLimitError(
                "Transcript storage reads exceed the per-request server limit"
            )
        return rows

    def prepare(self, rows: Sequence[Row]) -> Sequence[Row]:
        prepared = [dict(row) for row in rows]
        if prepared:
            self._prepare(prepared)
        return prepared

    def scan(self, stream: Stream, position: StreamPosition, limit: int) -> Sequence[Row]:
        column = "precise.start_ts" if stream == "start" else "precise.finish_ts"
        return self.query(
            f"{column}:>={position.timestamp:.9f}",
            [column, "project.id", "trace", "span_id"],
            position.offset,
            limit,
        )

    def parents(self, keys: Sequence[SourceKey]) -> Sequence[Row]:
        if not keys:
            return []
        condition = " OR ".join(
            f"(project.id:{project} "
            f"{build_escaped_term_filter('trace', [trace])} "
            f"{build_escaped_term_filter('span_id', [span_id])})"
            for project, trace, span_id in keys
        )
        return self.query(condition, [], 0, len(keys))

    def children(self, agent: Row, offset: int, limit: int) -> Sequence[Row]:
        key = source_key(agent)
        if key not in self.child_cache:
            project, trace, span_id = key
            scope = f"project.id:{project} {build_escaped_term_filter('trace', [trace])}"
            frontier = [span_id]
            visited = {span_id}
            children: list[dict[str, Any]] = []
            for _ in range(self.parent_depth):
                if not frontier:
                    break
                condition = f"{scope} {build_escaped_term_filter('parent_span', frontier)}"
                next_frontier = []
                read_offset = 0
                while True:
                    batch = self.query(
                        condition,
                        ["precise.start_ts", "span_id"],
                        read_offset,
                        100,
                        conversation_only=False,
                    )
                    for row in batch:
                        child_id = source_key(row)[2]
                        if child_id in visited:
                            continue
                        visited.add(child_id)
                        is_ai = bool(row.get("gen_ai.operation.type")) or any(
                            isinstance(value := row.get(field), str) and value.startswith("gen_ai.")
                            for field in ("span.op", "span.name")
                        )
                        if row.get("gen_ai.conversation.id") == self.conversation_id and is_ai:
                            children.append(row)
                        else:
                            next_frontier.append(child_id)
                    if len(batch) < 100:
                        break
                    read_offset += len(batch)
                frontier = next_frontier
            self.child_cache[key] = children
        return self.child_cache[key][offset : offset + limit]

    def previous(
        self, generation: Row, offset: int, limit: int, *, agent: Row | None
    ) -> Sequence[Row]:
        project, trace, _ = source_key(generation)
        condition = f"project.id:{project} precise.finish_ts:<={source_time(generation, 'end'):.9f}"
        if agent is not None:
            condition += (
                f" {build_escaped_term_filter('trace', [trace])}"
                f" precise.finish_ts:>={source_time(agent, 'start'):.9f}"
            )
        return self.query(
            condition,
            ["-precise.finish_ts", "-project.id", "-trace", "-span_id"],
            offset,
            limit,
        )
