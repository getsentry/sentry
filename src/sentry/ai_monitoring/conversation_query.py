from collections.abc import Iterator
from math import isfinite

from parsimonious.exceptions import ParseError
from parsimonious.nodes import Node

from sentry.ai_monitoring.constants import AI_CONVERSATIONS_FIELDS
from sentry.api.event_search import AggregateFilter, SearchFilter, event_search_grammar
from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.resolver import SearchResolver


def _nodes(node: Node, names: set[str], depth: int = 0) -> Iterator[Node]:
    """Walk the search syntax tree and yield nodes with the requested grammar names.

    Names come from event_search_grammar, not span fields:
    - filter: a complete field condition, e.g. toolCalls:>0.
    - free_text: text without a field name, e.g. "hello world".
    - boolean_operator: AND or OR between conditions.
    - paren_group: conditions in parentheses, e.g. (toolCalls:>0 OR errors:0).
    - search_key / text_key: the field name inside a filter, e.g. toolCalls.
    - aggregate_key: a function expression, e.g. sum(span.duration).
    - operator: a comparison inside a filter, e.g. >.

    Callers choose the level they need. For example, {"filter"} selects toolCalls:>0,
    while {"search_key"} descends into that filter to select just toolCalls.
    """
    # paren_group means a parenthesized search group: (toolCalls:>0) adds one level.
    # Function parentheses, such as sum(span.duration), are not search groups.
    if node.expr_name == "paren_group":
        depth += 1
    if depth > 20:
        raise InvalidSearchQuery("Conversation query has too many nested groups.")
    if node.expr_name in names:
        # Return the whole match and skip its contents. Selecting "filter" returns
        # toolCalls:>0 once, without also walking its key and value.
        yield node
    else:
        # Walk children in source order until we find a requested node. For example,
        # (toolCalls:>0 errors:0) yields two filters, both at the same group depth.
        for child in node.children:
            yield from _nodes(child, names, depth)


def _is_summary_field(name: str) -> bool:
    """Identify numeric summaries using the shared alias definitions.

    For example, totalCost and total_cost are summaries; conversationId and age are not.
    """
    field = AI_CONVERSATIONS_FIELDS.get(name.strip('"'))
    return field is not None and field[0] not in {"gen_ai.conversation.id", "max(timestamp)"}


def _compile_summary_filter(condition: Node, key: Node, resolver: SearchResolver) -> str:
    """Expand a summary alias such as totalCost into an aggregate comparison.

    Let EAP interpret values, units, and nulls. For example, totalCost:0 may exclude
    conversations with no recorded costs, even though the response displays zero.
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
    """Translate one user condition into a filter on a whole conversation.

    Expand summary aliases and reject user-written aggregates. For span fields and
    free text, require at least one matching span, or no matching spans for exclusions.
    For example, gen_ai.tool.name:search requires a matching span, while
    !gen_ai.tool.name:search requires none. Keep source text to preserve those meanings.
    """
    keys = list(_nodes(condition, {"aggregate_key", "search_key", "text_key"}))
    if keys:
        key = keys[0]
        if key.expr_name == "aggregate_key":
            raise InvalidSearchQuery(
                "Explicit aggregates are not supported in conversation filters. "
                "Use summary aliases or span fields instead."
            )
        if _is_summary_field(key.text):
            return _compile_summary_filter(condition, key, resolver)
        if key.text == "has" and any(_is_summary_field(k.text) for k in keys[1:]):
            raise InvalidSearchQuery("Use a numeric comparison for conversation summary fields.")

    # Preserve source text: !span.duration:>2s differs from span.duration:<=2s.
    positive = condition.text
    if "`" in positive:
        raise InvalidSearchQuery("Literal backticks are not supported in conversation filters.")
    excluded = False
    if condition.expr_name == "filter":
        excluded = positive.startswith("!")
        positive = positive.removeprefix("!")
        if any(operator.text == "!=" for operator in _nodes(condition, {"operator"})):
            positive = positive.replace("!=", "", 1)
            excluded = not excluded
        if keys and keys[0].text.strip('"') == "conversationId":
            positive = positive.replace(keys[0].text, "gen_ai.conversation.id", 1)
    return f"count_if(`{positive}`,span.duration):{'=0' if excluded else '>0'}"


def compile_conversation_query(query: str, resolver: SearchResolver) -> str:
    """Build the EAP query that selects matching conversation IDs before hydration.

    For general searches, restrict spans to those with a conversation ID and an AI
    operation. Apply rewritten conditions to groups, preserving the user's Boolean
    structure: toolCalls:>0 OR errors:>0 still means either condition can match.
    Return exact ID lookups such as gen_ai.conversation.id:abc unchanged.
    """
    # Keep source offsets: (toolCalls:>0 OR errors:0) yields two nodes, leaving OR untouched.
    try:
        conditions = list(_nodes(event_search_grammar.parse(query), {"filter", "free_text"}))
    except (ParseError, RecursionError) as error:
        # Parsing happens before EAP: turn malformed input such as "(errors:0" into a 400.
        raise InvalidSearchQuery(
            "Invalid conversation query. Check parentheses and quoting."
        ) from error
    # EAP's nested protobuf filters cannot handle long chains, e.g. 51 span predicates.
    if len(conditions) > 50:
        raise InvalidSearchQuery("Conversation queries may contain at most 50 conditions.")
    parts: list[str] = []
    offset = 0
    for condition in conditions:
        parts.extend((query[offset : condition.start], _compile_condition(condition, resolver)))
        offset = condition.end
    parts.append(query[offset:])
    group_query = "".join(parts).strip()

    # Conversation IDs imply AI operation types, so gen_ai.conversation.id:abc needs no scope.
    if len(conditions) == 1:
        terms = resolver.parse_search_query(query)
        if (
            len(terms) == 1
            and isinstance(term := terms[0], SearchFilter)
            and term.key.name == "gen_ai.conversation.id"
            and term.operator == "="
            and term.value.raw_value
            and not term.value.is_wildcard()
        ):
            return query

    conversation_scope = "has:gen_ai.conversation.id has:gen_ai.operation.type"
    return f"{conversation_scope} AND ({group_query})" if group_query else conversation_scope
