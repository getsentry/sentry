from __future__ import annotations

from sentry.ai_monitoring.conversation_query import (
    CONVERSATION_RESOLVER_CONFIG,
    compile_conversation_query,
)
from sentry.search.events.types import SnubaParams
from sentry.snuba.spans_rpc import Spans


def compile_conversation_filter(filter_query: str, snuba_params: SnubaParams) -> str:
    """Compile a classifier filter into a query that selects whole conversations.

    Span conditions match when any span in the conversation matches them. Raises
    InvalidSearchQuery for filters that can't be compiled or resolved.
    """
    resolver = Spans.get_resolver(snuba_params, CONVERSATION_RESOLVER_CONFIG)
    query = compile_conversation_query(filter_query, resolver)
    # Resolve without querying, so invalid filters fail at creation instead of at selection.
    resolver.resolve_query(query)
    return query
