from collections.abc import Sequence
from typing import Any, Literal, NotRequired, TypedDict

from sentry.api import event_search
from sentry.api.event_search import ParenExpression, QueryToken, SearchFilter
from sentry.sentry_metrics.extraction_rules import MetricsExtractionRule
from sentry.snuba.metrics.extraction import RuleCondition, SearchQueryConverter, TagSpec

# Matches the top level span attributes defined in Relay
# https://github.com/getsentry/relay/blob/e59f21d92252c3dc9d350133c634d5a5fd6a3499/relay-event-schema/src/protocol/span.rs#L119
_TOP_LEVEL_SPAN_ATTRIBUTES = [
    "span.exclusive_time",
    "span.description",
    "span.op",
    "span.span_id",
    "span.parent_span_id",
    "span.trace_id",
    "span.status",
    "span.origin",
    "span.duration",
]


class SpanAttributeMetricSpec(TypedDict):
    category: Literal["span"]
    mri: str
    field: NotRequired[str | None]
    condition: NotRequired[RuleCondition | None]
    tags: NotRequired[Sequence[TagSpec]]


def convert_to_spec(extraction_rule: MetricsExtractionRule) -> SpanAttributeMetricSpec:

    field = _get_field(extraction_rule)
    parsed_conditions = _parse_conditions(extraction_rule.conditions)

    return {
        "category": "span",
        "mri": extraction_rule.generate_mri(),
        "field": field,
        "tags": _get_tags(extraction_rule.tags, parsed_conditions),
        "condition": _get_condition(parsed_conditions),
    }


def _get_field(extraction_rule: MetricsExtractionRule) -> str | None:
    if extraction_rule.type == "c":
        return None

    return _map_span_attribute_name(extraction_rule.span_attribute)


def _get_tags(
    explicitly_defined_tags: set[str], conditions: Sequence[QueryToken] | None
) -> list[TagSpec]:
    """
    Merges the explicitly defined tags with the tags extracted from the search conditions.
    """
    token_list = _flatten_query_tokens(conditions) if conditions else []
    search_token_keys = {token.key.name for token in token_list}

    tag_keys = explicitly_defined_tags.union(search_token_keys)

    return [TagSpec(key=key, field=_map_span_attribute_name(key)) for key in sorted(tag_keys)]


def _flatten_query_tokens(conditions: Sequence[QueryToken]) -> list[SearchFilter]:
    query_tokens: list[SearchFilter] = []

    for token in conditions:
        if isinstance(token, SearchFilter):
            query_tokens.append(token)
        elif isinstance(token, ParenExpression):
            query_tokens = query_tokens + _flatten_query_tokens(token.children)
        else:
            pass

    return query_tokens


def _parse_conditions(conditions: Sequence[str] | None) -> Sequence[QueryToken]:
    if not conditions:
        return []

    search_query = " or ".join([f"({condition})" for condition in conditions])
    parsed_search_query = event_search.parse_search_query(search_query)

    return parsed_search_query


def _get_condition(parsed_search_query: Sequence[Any] | None) -> RuleCondition | None:
    if not parsed_search_query:
        return None

    return SearchQueryConverter(
        parsed_search_query, field_mapper=_map_span_attribute_name
    ).convert()


def _map_span_attribute_name(span_attribute: str) -> str:
    if span_attribute in _TOP_LEVEL_SPAN_ATTRIBUTES:
        return span_attribute

    sanitized_span_attr = span_attribute.replace(".", "\\.")

    return f"span.data.{sanitized_span_attr}"
