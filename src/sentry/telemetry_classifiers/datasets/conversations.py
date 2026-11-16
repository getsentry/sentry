from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import datetime, timedelta
from typing import Any

from django.utils import timezone

from sentry.ai_monitoring.conversation_query import (
    CONVERSATION_RESOLVER_CONFIG,
    compile_conversation_query,
)
from sentry.ai_monitoring.message_normalizer import (
    normalize_to_messages,
    stringify_message_content,
)
from sentry.constants import DataCategory
from sentry.models.project import Project
from sentry.search.eap.occurrences.query_utils import build_escaped_term_filter
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans
from sentry.telemetry_classifiers.types import Dataset, Event, TelemetryInput
from sentry.utils import metrics

CONVERSATION_ID = "gen_ai.conversation.id"
# How far back a conversation's spans are read, both for filters and for its events.
LOOKBACK = timedelta(days=7)
MAX_SPANS = 1_000
# Longer messages are cut, so one message can't use up the classifier model's input limit.
MAX_MESSAGE_CHARS = 4_000

# Message attributes and the role assumed when a message doesn't name one.
_MESSAGE_ATTRIBUTES = {"gen_ai.input.messages": "user", "gen_ai.output.messages": "assistant"}
_ROLES = frozenset({"user", "assistant"})


class ConversationDataset:
    """AI conversations: spans grouped by ``gen_ai.conversation.id``."""

    # A conversation is classified once 20 minutes pass after its last span.
    cooldown = timedelta(minutes=20)
    data_category = DataCategory.SPAN

    def compile_filter(self, filter_query: str, snuba_params: SnubaParams) -> str:
        """Compile a classifier filter into a query that selects whole conversations.

        Span conditions match when any span in the conversation matches them. Raises
        InvalidSearchQuery for filters that can't be compiled or resolved.
        """
        resolver = Spans.get_resolver(snuba_params, CONVERSATION_RESOLVER_CONFIG)
        query = compile_conversation_query(filter_query, resolver)
        # Resolve without querying, so invalid filters fail at creation instead of at selection.
        resolver.resolve_query(query)
        return query

    def select(
        self,
        project: Project,
        filter_query: str,
        start: datetime,
        end: datetime,
        limit: int,
        offset: int,
    ) -> list[str]:
        """Return a page of IDs of conversations whose cooldown ended in ``[start, end)`` and that match
        the filter.

        Any newer span keeps a conversation out until it goes quiet again.
        """
        now = timezone.now()
        last_span_start = int((start - self.cooldown).timestamp())
        last_span_end = int((end - self.cooldown).timestamp())
        # The filter needs all of a conversation's spans, so the query covers the lookback.
        params = SnubaParams(
            start=now - LOOKBACK, end=now, projects=[project], organization=project.organization
        )
        result = Spans.run_table_query(
            params=params,
            query_string=(
                f"{self.compile_filter(filter_query, params)} "
                f"max(timestamp):>={last_span_start} max(timestamp):<{last_span_end}"
            ),
            selected_columns=[CONVERSATION_ID, "max(timestamp)"],
            orderby=["-max(timestamp)", CONVERSATION_ID],
            offset=offset,
            limit=limit,
            referrer=Referrer.TELEMETRY_CLASSIFIERS_CONVERSATIONS_SELECT.value,
            config=CONVERSATION_RESOLVER_CONFIG,
            sampling_mode="HIGHEST_ACCURACY",
        )
        return [row[CONVERSATION_ID] for row in result["data"]]

    def load(self, project: Project, entity_id: str) -> TelemetryInput | None:
        """Load the conversation's newest spans with messages as user and assistant messages."""
        now = timezone.now()
        result = Spans.run_table_query(
            params=SnubaParams(
                start=now - LOOKBACK, end=now, projects=[project], organization=project.organization
            ),
            query_string=(
                f"{build_escaped_term_filter(CONVERSATION_ID, [entity_id])} "
                "has:gen_ai.operation.type "
                "(has:gen_ai.input.messages OR has:gen_ai.output.messages)"
            ),
            selected_columns=["timestamp", "trace", "client_sample_rate", *_MESSAGE_ATTRIBUTES],
            orderby=["-timestamp"],
            offset=0,
            limit=MAX_SPANS + 1,
            referrer=Referrer.TELEMETRY_CLASSIFIERS_CONVERSATIONS_LOAD.value,
            config=SearchResolverConfig(auto_fields=False),
            sampling_mode="HIGHEST_ACCURACY",
        )
        rows = result["data"]
        if not rows:
            return None

        events, messages_cut = _message_events(list(reversed(rows[:MAX_SPANS])))
        truncated = len(rows) > MAX_SPANS or messages_cut
        if truncated:
            metrics.incr(
                "telemetry_classifiers.load.truncated", tags={"dataset": Dataset.CONVERSATION}
            )
        newest = rows[0]
        return TelemetryInput(
            events=events,
            truncated=truncated,
            trace_id=newest["trace"],
            timestamp=datetime.fromisoformat(newest["timestamp"]),
            client_sample_rate=newest.get("client_sample_rate") or 1.0,
            conversation_id=entity_id,
        )


def _message_events(spans: Sequence[Mapping[str, Any]]) -> tuple[list[Event], bool]:
    """Turn oldest-first spans into one event per distinct user or assistant message.

    Each LLM span repeats the history before it, so a message is kept only the first time it
    appears. Returns the events and whether any message was cut to MAX_MESSAGE_CHARS.
    """
    events: list[Event] = []
    seen: set[tuple[str, str]] = set()
    cut = False
    for span in spans:
        for attribute, default_role in _MESSAGE_ATTRIBUTES.items():
            for message in normalize_to_messages(span.get(attribute), default_role) or []:
                role = message["role"]
                content = stringify_message_content(message["content"])
                if role not in _ROLES or not content or not content.strip():
                    continue
                if (role, content) in seen:
                    continue
                seen.add((role, content))
                if len(content) > MAX_MESSAGE_CHARS:
                    content = content[:MAX_MESSAGE_CHARS]
                    cut = True
                events.append({"role": role, "content": content})
    return events, cut
