"""Rewrite span filters so they apply to a whole conversation.

Normal search asks one span to match every `AND` condition. Conversation data can live on
different spans, so we instead count matching spans after grouping by conversation ID:

    gen_ai.agent.name:researcher AND gen_ai.tool.name:search
    → count_if(`gen_ai.agent.name:researcher`,span.duration):>0
      AND count_if(`gen_ai.tool.name:search`,span.duration):>0

We use `event_search_grammar` because values can contain spaces, quotes, and parentheses.
For `gen_ai.tool.name:search OR totalCost:>10`, its named nodes are:

    search
    ├── term → filter → text_filter
    │                    ├── text_key → search_key → key: gen_ai.tool.name
    │                    └── search_value → value: search
    ├── term → boolean_operator → or_operator: OR
    └── term → filter → numeric_filter
                         ├── search_key → key: totalCost
                         ├── operator: >
                         └── numeric_value → numeric: 10

Compiler replaces complete `filter` nodes by source position and keeps Boolean syntax.
"""

from collections.abc import Iterator
from math import isfinite

from parsimonious.exceptions import ParseError
from parsimonious.nodes import Node

from sentry.ai_monitoring.constants import AI_CONVERSATIONS_FIELDS
from sentry.api.event_search import AggregateFilter, event_search_grammar
from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.resolver import SearchResolver


def _nodes(node: Node, names: set[str], depth: int = 0) -> Iterator[Node]:
    """Yield requested parts of a parsed search query.

    For example, `(toolCalls:>0 OR errors:0)` is a `paren_group` containing two
    `filter` nodes and a `boolean_operator`. Asking for `filter` yields both filters.
    """
    # Only parenthesized search groups count toward this limit. Function calls do not.
    if node.expr_name == "paren_group":
        depth += 1
    if depth > 20:
        raise InvalidSearchQuery("Conversation query has too many nested groups.")
    if node.expr_name in names:
        # Treat a match as one unit. For example, asking for `filter` returns
        # `toolCalls:>0`, not its nested `search_key` and `operator` nodes.
        yield node
    else:
        for child in node.children:
            yield from _nodes(child, names, depth)


def _is_aggregate_alias(name: str) -> bool:
    """Return whether a name is a filterable aggregate alias, such as `totalCost`."""
    field = AI_CONVERSATIONS_FIELDS.get(name.strip('"'))
    # Conversation ID is a stored field. max(timestamp) aliases are only expanded
    # when sorting, not when filtering.
    return field is not None and field[0] not in {"gen_ai.conversation.id", "max(timestamp)"}


def _compile_alias_filter(condition: Node, key: Node, resolver: SearchResolver) -> str:
    """Replace a table alias with the EAP expression that calculates it.

    For example, `totalCost:>10` becomes
    `sum_if(gen_ai.cost.total_tokens,gen_ai.operation.type,equals,ai_client):>10`.
    """
    expression, _ = AI_CONVERSATIONS_FIELDS[key.text.strip('"')]
    query = condition.text.replace(key.text, expression, 1)
    terms = resolver.parse_search_query(query)
    if len(terms) != 1 or not isinstance(terms[0], AggregateFilter):
        raise InvalidSearchQuery(f"Invalid conversation aggregate filter: {condition.text}")
    term = terms[0]
    value = term.value.raw_value
    if not isinstance(value, (int, float)) or not isfinite(value):
        raise InvalidSearchQuery(f"Expected a finite numeric aggregate value: {condition.text}")
    return term.to_query_string()


def _compile_condition(condition: Node, resolver: SearchResolver) -> str:
    """Make one condition apply to a whole conversation.

    For example, `gen_ai.tool.name:search` becomes
    ``count_if(`gen_ai.tool.name:search`,span.duration):>0``.
    Aggregate conditions already apply to the whole conversation, so they stay unchanged.
    """
    keys = list(_nodes(condition, {"aggregate_key", "search_key", "text_key"}))
    if keys:
        key = keys[0]
        if key.expr_name == "aggregate_key":
            # Keep aggregates such as `sum(span.duration):>10` unchanged.
            return condition.text
        if _is_aggregate_alias(key.text):
            return _compile_alias_filter(condition, key, resolver)
        if key.text == "has" and any(_is_aggregate_alias(k.text) for k in keys[1:]):
            raise InvalidSearchQuery("Use a numeric comparison for aggregate aliases.")

    # `!span.duration:>2s` means no span exceeds 2s. `span.duration:<=2s` only
    # needs one short span, so keep the predicate and handle negation separately.
    positive = condition.text
    # We wrap this text in backticks below. An input backtick could close that wrapper.
    if "`" in positive:
        raise InvalidSearchQuery("Literal backticks are not supported in conversation filters.")
    excluded = False
    if condition.expr_name == "filter":
        excluded = positive.startswith("!")
        positive = positive.removeprefix("!")
        # Both `!field:value` and `field:!=value` mean zero positive matches.
        if any(operator.text == "!=" for operator in _nodes(condition, {"operator"})):
            positive = positive.replace("!=", "", 1)
            excluded = not excluded
        if keys:
            field = AI_CONVERSATIONS_FIELDS.get(keys[0].text.strip('"'))
            if field and field[0] == "gen_ai.conversation.id":
                # Replace UI alias with stored span field.
                positive = positive.replace(keys[0].text, field[0], 1)
    return f"count_if(`{positive}`,span.duration):{'=0' if excluded else '>0'}"


def compile_conversation_query(query: str, resolver: SearchResolver) -> str:
    """Turn span filters into conversation filters while keeping Boolean logic.

    For example, `gen_ai.tool.name:search OR errors:>0` can match either any search
    span or the conversation's error total.
    """
    try:
        conditions = list(_nodes(event_search_grammar.parse(query), {"filter", "free_text"}))
    except (ParseError, RecursionError) as error:
        # Convert malformed input such as `(errors:0` into a 400.
        raise InvalidSearchQuery(
            "Invalid conversation query. Check parentheses and quoting."
        ) from error
    # Combine unchanged text with compiled conditions. For `a:1 OR b:2`, the slices
    # preserve ` OR ` while each condition gets replaced.
    parts: list[str] = []
    offset = 0
    for condition in conditions:
        parts.extend((query[offset : condition.start], _compile_condition(condition, resolver)))
        offset = condition.end
    parts.append(query[offset:])
    group_query = "".join(parts).strip()

    conversation_scope = "has:gen_ai.conversation.id has:gen_ai.operation.type"
    return f"{conversation_scope} AND ({group_query})" if group_query else conversation_scope
