from collections.abc import Sequence
from typing import Literal, NotRequired, TypedDict

from sentry.api import event_search
from sentry.api.event_search import ParenExpression, QueryToken, SearchFilter, SearchValue
from sentry.relay.types import RuleCondition
from sentry.sentry_metrics.extraction_rules import MetricsExtractionRule
from sentry.snuba.metrics.extraction import SearchQueryConverter, TagSpec

# Matches the top level span attributes defined in Relay
# https://github.com/getsentry/relay/blob/e59f21d9/relay-event-schema/src/protocol/span.rs#L119
_TOP_LEVEL_SPAN_ATTRIBUTES = {
    "span.exclusive_time",
    "span.description",
    "span.op",
    "span.span_id",
    "span.parent_span_id",
    "span.trace_id",
    "span.status",
    "span.origin",
    "span.duration",
}

# Matches the keys stored in span.sentry_tags
# https://github.com/getsentry/relay/blob/e59f21d9/relay-event-normalization/src/normalize/span/tag_extraction.rs#L90
_SENTRY_TAGS = {
    "release",
    "user",
    "user.id",
    "user.username",
    "user.email",
    "environment",
    "transaction",
    "transaction.method",
    "transaction.op",
    "mobile",
    "device.class",
    "browser.name",
    "sdk.name",
    "sdk.version",
    "platform",
    "action",
    "ai_pipeline_group",
    "category",
    "description",
    "domain",
    "raw_domain",
    "group",
    "http.decoded_response_content_length",
    "http.response_content_length",
    "http.response_transfer_size",
    "resource.render_blocking_status",
    "op",
    "status",
    "status_code",
    "system",
    "ttfd",
    "ttid",
    "file_extension",
    "main_thread",
    "cache.hit",
    "cache.key",
    "os.name",
    "app_start_type",
    "replay_id",
    "trace.status",
    "messaging.destination.name",
    "messaging.message.id",
}


class SpanAttributeMetricSpec(TypedDict):
    category: Literal["span"]
    mri: str
    field: NotRequired[str | None]
    condition: NotRequired[RuleCondition | None]
    tags: NotRequired[Sequence[TagSpec]]


def convert_to_metric_spec(extraction_rule: MetricsExtractionRule) -> SpanAttributeMetricSpec:

    field = _get_field(extraction_rule)

    parsed_conditions = event_search.parse_search_query(extraction_rule.condition)
    extended_conditions = _extend_parsed_condtions(parsed_conditions)

    return {
        "category": "span",
        "mri": extraction_rule.generate_mri(),
        "field": field,
        "tags": _get_tags(extraction_rule, parsed_conditions),
        "condition": _get_rule_condition(extraction_rule, extended_conditions),
    }


# Tag extraction


def _get_tags(
    extraction_rule: MetricsExtractionRule, parsed_search_query: Sequence[QueryToken] | None
) -> list[TagSpec]:
    """
    Merges the explicitly defined tags with the tags extracted from the search query.
    """
    token_list = _flatten_query_tokens(parsed_search_query) if parsed_search_query else []
    search_token_keys = {token.key.name for token in token_list}

    tag_keys = extraction_rule.tags.union(search_token_keys)

    return [TagSpec(key=key, field=_map_span_attribute_name(key)) for key in sorted(tag_keys)]


def _flatten_query_tokens(parsed_search_query: Sequence[QueryToken]) -> list[SearchFilter]:
    """
    Takes a parsed search query and flattens it into a list of SearchFilter tokens.
    Removes any parenthesis and boolean operators.
    """
    query_tokens: list[SearchFilter] = []

    for token in parsed_search_query:
        if isinstance(token, SearchFilter):
            query_tokens.append(token)
        elif isinstance(token, ParenExpression):
            query_tokens = query_tokens + _flatten_query_tokens(token.children)

    return query_tokens


# Condition string parsing and transformation


def _extend_parsed_condtions(parsed_search_query: Sequence[QueryToken]) -> Sequence[QueryToken]:
    return _visit_numeric_tokens(parsed_search_query)


def _visit_numeric_tokens(parsed_search_query: Sequence[QueryToken]) -> list[QueryToken]:
    """
    Visits each token in the parsed search query and converts numeric tokens into paren expressions.
    """
    query_tokens: list[QueryToken] = []

    for token in parsed_search_query:
        if isinstance(token, SearchFilter):
            query_tokens.append(_extend_numeric_token(token))
        elif isinstance(token, ParenExpression):
            query_tokens = query_tokens + _visit_numeric_tokens(token.children)
        else:
            query_tokens.append(token)

    return query_tokens


def _extend_numeric_token(token: SearchFilter) -> ParenExpression | SearchFilter:
    """
    Since all search filter values are parsed as strings by default, we need to make sure that
    numeric values are treated as such when constructing the rule condition. This function
    expands the original token into a paren expression if the value is a numeric string.

    Example:
    `key:'123'` -> `key:'123' OR key:123`
    `key:['123', '456']` -> `key:['123', '456'] OR key:[123, 456]`

    """
    if token.operator == "=" or token.operator == "!=":
        if not str(token.value.value).isdigit():
            return token

        numeric_value_token = SearchFilter(
            key=token.key, operator=token.operator, value=SearchValue(int(token.value.value))
        )

    elif token.is_in_filter:
        str_values = [str(value) for value in token.value.value]
        if not all(value.isdigit() for value in str_values):
            return token

        numeric_values = [int(value) for value in str_values]
        numeric_value_token = SearchFilter(
            key=token.key, operator=token.operator, value=SearchValue(numeric_values)
        )

    if not numeric_value_token:
        return token

    return ParenExpression(
        children=[
            token,
            "OR",
            numeric_value_token,
        ]
    )


# Conversion to RuleCondition


def _get_rule_condition(
    extraction_rule: MetricsExtractionRule, parsed_search_query: Sequence[QueryToken]
) -> RuleCondition | None:
    if _is_counter(extraction_rule):
        return _get_counter_rule_condition(extraction_rule, parsed_search_query)

    if not parsed_search_query:
        return None

    return SearchQueryConverter(
        parsed_search_query, field_mapper=_map_span_attribute_name
    ).convert()


def _get_counter_rule_condition(
    extraction_rule: MetricsExtractionRule, parsed_conditions: Sequence[QueryToken]
) -> RuleCondition | None:
    is_top_level = extraction_rule.span_attribute in _TOP_LEVEL_SPAN_ATTRIBUTES

    if not parsed_conditions:
        # temporary workaround for span.duration counter metric
        if is_top_level:
            return None

        return _get_exists_condition(extraction_rule.span_attribute)

    condition_dict = SearchQueryConverter(
        parsed_conditions, field_mapper=_map_span_attribute_name
    ).convert()

    if is_top_level:
        return condition_dict

    return _append_exists_condition(
        condition_dict,
        extraction_rule.span_attribute,
    )


def _append_exists_condition(rule_condition: RuleCondition, span_attribute: str) -> RuleCondition:
    return {
        "op": "and",
        "inner": [
            rule_condition,
            _get_exists_condition(span_attribute),
        ],
    }


def _get_exists_condition(span_attribute: str) -> RuleCondition:
    return {
        "op": "not",
        "inner": {
            "name": _map_span_attribute_name(span_attribute),
            "op": "eq",
            "value": None,
        },
    }


# General helpers


def _map_span_attribute_name(span_attribute: str) -> str:
    if span_attribute in _TOP_LEVEL_SPAN_ATTRIBUTES:
        return span_attribute

    if span_attribute in _SENTRY_TAGS:
        return f"span.sentry_tags.{span_attribute}"

    sanitized_span_attr = span_attribute.replace(".", "\\.")

    return f"span.data.{sanitized_span_attr}"


def _is_counter(extraction_rule: MetricsExtractionRule) -> bool:
    return extraction_rule.type == "c"


def _get_field(extraction_rule: MetricsExtractionRule) -> str | None:
    if _is_counter(extraction_rule):
        return None

    return _map_span_attribute_name(extraction_rule.span_attribute)
