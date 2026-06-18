"""Selectable/filterable columns for the AI Conversations table.

The id query runs over the full org volume and owns the sort and filtering; the
detail queries are bounded to the resulting page of ids and only run when one of
their fields was requested. Gated behind ``organizations:gen-ai-conversations-columns``.
"""

from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass
from enum import Enum
from typing import Any

import sentry_sdk
from rest_framework.exceptions import ParseError

from sentry.api.helpers.ai_conversations_shared import (
    build_user_response,
    compute_timestamp_ms,
    get_first_input_message,
    get_last_output,
    to_timestamp_float,
)
from sentry.search.eap.occurrences.query_utils import build_escaped_term_filter
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import EAPResponse, SearchResolverConfig
from sentry.search.events.constants import NON_FAILURE_STATUS
from sentry.search.events.types import SAMPLING_MODES, SnubaParams
from sentry.snuba.referrer import Referrer
from sentry.snuba.rpc_dataset_common import TableQuery
from sentry.snuba.spans_rpc import Spans

CONVERSATION_ID = "conversationId"
START_TIMESTAMP = "startTimestamp"
END_TIMESTAMP = "endTimestamp"
DURATION = "duration"
ERRORS = "errors"
LLM_CALLS = "llmCalls"
TOOL_CALLS = "toolCalls"
TOTAL_TOKENS = "totalTokens"
TOTAL_COST = "totalCost"
TRACE_COUNT = "traceCount"
USER = "user"
MODELS_USED = "modelsUsed"
TOOL_NAMES = "toolNames"
FLOW = "flow"
TRACE_IDS = "traceIds"
TOOL_ERRORS = "toolErrors"
FIRST_INPUT = "firstInput"
LAST_OUTPUT = "lastOutput"

_MIN_START = "min(precise.start_ts)"
_MAX_FINISH = "max(precise.finish_ts)"
_FAILURE_COUNT = "failure_count()"
_COUNT_AI_CLIENT = "count_if(gen_ai.operation.type,equals,ai_client)"
_COUNT_TOOL = "count_if(gen_ai.operation.type,equals,tool)"
_SUM_TOKENS = "sum_if(gen_ai.usage.total_tokens,gen_ai.operation.type,equals,ai_client)"
_SUM_COST = "sum_if(gen_ai.cost.total_tokens,gen_ai.operation.type,equals,ai_client)"
_COUNT_UNIQUE_TRACE = "count_unique(trace)"
_ANY_USER_ID = "any(user.id)"
_ANY_USER_EMAIL = "any(user.email)"
_ANY_USER_USERNAME = "any(user.username)"
_ANY_USER_IP = "any(user.ip)"
_ANY_MODEL = "any(gen_ai.request.model)"
# Sortable via an equation; duration HAVING is rejected in _translate_aggregate_filters.
_EQUATION_DURATION = f"{_MAX_FINISH} - {_MIN_START}"

_ENRICHMENT_COLUMNS = (
    "gen_ai.conversation.id",
    "gen_ai.operation.type",
    "gen_ai.agent.name",
    "gen_ai.tool.name",
    "span.status",
    "trace",
    "timestamp",
)
_IO_COLUMNS = (
    "gen_ai.conversation.id",
    "gen_ai.input.messages",
    "gen_ai.output.messages",
    "gen_ai.request.messages",
    "gen_ai.response.text",
    "timestamp",
)

_SCAN_LIMIT = 10000


class SourceQuery(Enum):
    """Which query produces a field. IDS comes from the always-on id query."""

    IDS = "ids"
    AGGREGATES = "aggregates"
    ENRICHMENT = "enrichment"
    IO = "io"


@dataclass(frozen=True)
class FieldSpec:
    source: SourceQuery
    eap_columns: tuple[str, ...]
    sort_expr: str | None = None
    aggregate_filter_expr: str | None = None


FIELD_REGISTRY: dict[str, FieldSpec] = {
    CONVERSATION_ID: FieldSpec(SourceQuery.IDS, ("gen_ai.conversation.id",)),
    END_TIMESTAMP: FieldSpec(SourceQuery.AGGREGATES, (_MAX_FINISH,), sort_expr=_MAX_FINISH),
    START_TIMESTAMP: FieldSpec(SourceQuery.AGGREGATES, (_MIN_START,)),
    DURATION: FieldSpec(
        SourceQuery.AGGREGATES, (_MIN_START, _MAX_FINISH), sort_expr=_EQUATION_DURATION
    ),
    ERRORS: FieldSpec(
        SourceQuery.AGGREGATES,
        (_FAILURE_COUNT,),
        sort_expr=_FAILURE_COUNT,
        aggregate_filter_expr=_FAILURE_COUNT,
    ),
    LLM_CALLS: FieldSpec(
        SourceQuery.AGGREGATES,
        (_COUNT_AI_CLIENT,),
        sort_expr=_COUNT_AI_CLIENT,
        aggregate_filter_expr=_COUNT_AI_CLIENT,
    ),
    TOOL_CALLS: FieldSpec(
        SourceQuery.AGGREGATES,
        (_COUNT_TOOL,),
        sort_expr=_COUNT_TOOL,
        aggregate_filter_expr=_COUNT_TOOL,
    ),
    TOTAL_TOKENS: FieldSpec(
        SourceQuery.AGGREGATES,
        (_SUM_TOKENS,),
        sort_expr=_SUM_TOKENS,
        aggregate_filter_expr=_SUM_TOKENS,
    ),
    TOTAL_COST: FieldSpec(
        SourceQuery.AGGREGATES,
        (_SUM_COST,),
        sort_expr=_SUM_COST,
        aggregate_filter_expr=_SUM_COST,
    ),
    TRACE_COUNT: FieldSpec(
        SourceQuery.AGGREGATES,
        (_COUNT_UNIQUE_TRACE,),
        sort_expr=_COUNT_UNIQUE_TRACE,
        aggregate_filter_expr=_COUNT_UNIQUE_TRACE,
    ),
    USER: FieldSpec(
        SourceQuery.AGGREGATES,
        (_ANY_USER_ID, _ANY_USER_EMAIL, _ANY_USER_USERNAME, _ANY_USER_IP),
    ),
    MODELS_USED: FieldSpec(SourceQuery.AGGREGATES, (_ANY_MODEL,)),
    TOOL_NAMES: FieldSpec(SourceQuery.ENRICHMENT, _ENRICHMENT_COLUMNS),
    FLOW: FieldSpec(SourceQuery.ENRICHMENT, _ENRICHMENT_COLUMNS),
    TRACE_IDS: FieldSpec(SourceQuery.ENRICHMENT, _ENRICHMENT_COLUMNS),
    TOOL_ERRORS: FieldSpec(SourceQuery.ENRICHMENT, _ENRICHMENT_COLUMNS),
    FIRST_INPUT: FieldSpec(SourceQuery.IO, _IO_COLUMNS),
    LAST_OUTPUT: FieldSpec(SourceQuery.IO, _IO_COLUMNS),
}

DEFAULT_FIELDS: tuple[str, ...] = (
    CONVERSATION_ID,
    USER,
    END_TIMESTAMP,
    LLM_CALLS,
    TOOL_CALLS,
    TOTAL_TOKENS,
    TOTAL_COST,
    ERRORS,
    MODELS_USED,
)

DEFAULT_SORT = f"-{END_TIMESTAMP}"

SORTABLE_FIELDS: dict[str, str] = {
    name: spec.sort_expr for name, spec in FIELD_REGISTRY.items() if spec.sort_expr
}
AGGREGATE_FILTER_FIELDS: dict[str, str] = {
    name: spec.aggregate_filter_expr
    for name, spec in FIELD_REGISTRY.items()
    if spec.aggregate_filter_expr
}

_BASE_FILTER = (
    "has:gen_ai.conversation.id"
    " (has:gen_ai.input.messages OR has:gen_ai.request.messages)"
    " (has:gen_ai.output.messages OR has:gen_ai.response.text)"
)


def resolve_requested_fields(fields: list[str]) -> list[str]:
    """Validate, default, and dedupe fields, always keeping conversationId."""
    requested = list(fields) if fields else list(DEFAULT_FIELDS)

    resolved: list[str] = []
    seen: set[str] = set()
    for field in requested:
        if field not in FIELD_REGISTRY:
            raise ParseError(detail=f"Unsupported field: {field}")
        if field not in seen:
            seen.add(field)
            resolved.append(field)

    if CONVERSATION_ID not in seen:
        resolved.insert(0, CONVERSATION_ID)
    return resolved


def resolve_sort(orderby: list[str] | None) -> tuple[str, bool]:
    """Resolve the single sort field and direction, defaulting to -endTimestamp."""
    raw = orderby[0] if orderby else DEFAULT_SORT
    descending = raw.startswith("-")
    field = raw[1:] if descending else raw
    if field not in SORTABLE_FIELDS:
        raise ParseError(detail=f"Cannot sort by: {field}")
    return field, descending


def build_id_query_string(user_query: str) -> str:
    """Combine the base filter with the (translated) user query."""
    translated = _translate_aggregate_filters(user_query)
    if translated and translated.strip():
        return f"{_BASE_FILTER} {translated.strip()}"
    return _BASE_FILTER


def _translate_aggregate_filters(user_query: str) -> str:
    """Rewrite aggregate-alias filters (totalTokens:>1000 -> sum_if(...):>1000) to HAVING.

    Plain attribute filters pass through; duration filters are rejected.
    """
    if not user_query:
        return ""

    if re.search(rf"(?<![\w.-]){re.escape(DURATION)}:", user_query):
        raise ParseError(detail="Filtering by duration is not supported")

    translated = user_query
    for alias, expr in AGGREGATE_FILTER_FIELDS.items():
        translated = re.sub(
            rf"(?<![\w.-]){re.escape(alias)}:",
            f"{expr}:",
            translated,
        )
    return translated


@sentry_sdk.trace
def get_conversations_columns(
    snuba_params: SnubaParams,
    *,
    fields: list[str],
    orderby: tuple[str, bool],
    sampling_mode: SAMPLING_MODES,
    offset: int,
    limit: int,
) -> list[dict[str, Any]]:
    sort_field, descending = orderby
    query_string = build_id_query_string(snuba_params.query_string or "")

    conversation_ids = _fetch_conversation_ids(
        snuba_params,
        query_string=query_string,
        sort_field=sort_field,
        descending=descending,
        offset=offset,
        limit=limit,
        sampling_mode=sampling_mode,
    )

    sentry_sdk.set_tag("ai_conversations.count", len(conversation_ids))
    sentry_sdk.set_attribute("ai_conversations.count", len(conversation_ids))

    if not conversation_ids:
        return []

    return _fill_conversation_data(snuba_params, conversation_ids, fields)


@sentry_sdk.trace
def _fetch_conversation_ids(
    snuba_params: SnubaParams,
    *,
    query_string: str,
    sort_field: str,
    descending: bool,
    offset: int,
    limit: int,
    sampling_mode: SAMPLING_MODES,
) -> list[str]:
    prefix = "-" if descending else ""

    if sort_field == DURATION:
        equations: list[str] | None = [_EQUATION_DURATION]
        selected_columns = ["gen_ai.conversation.id"]
        orderby = [f"{prefix}equation|{_EQUATION_DURATION}"]
    else:
        sort_expr = SORTABLE_FIELDS[sort_field]
        equations = None
        selected_columns = ["gen_ai.conversation.id", sort_expr]
        orderby = [f"{prefix}{sort_expr}"]

    results = Spans.run_table_query(
        params=snuba_params,
        query_string=query_string,
        selected_columns=selected_columns,
        equations=equations,
        orderby=orderby,
        offset=offset,
        limit=limit,
        referrer=Referrer.API_AI_CONVERSATIONS.value,
        config=SearchResolverConfig(auto_fields=True, use_aggregate_conditions=True),
        sampling_mode=sampling_mode,
    )
    return [
        conv_id for row in results.get("data", []) if (conv_id := row.get("gen_ai.conversation.id"))
    ]


@sentry_sdk.trace
def _fill_conversation_data(
    snuba_params: SnubaParams, conversation_ids: list[str], fields: list[str]
) -> list[dict[str, Any]]:
    needed = {FIELD_REGISTRY[field].source for field in fields}
    resolver = Spans.get_resolver(snuba_params, SearchResolverConfig(auto_fields=True))

    queries: list[TableQuery] = []
    if SourceQuery.AGGREGATES in needed:
        queries.append(_build_aggregates_query(resolver, conversation_ids, fields))
    if SourceQuery.ENRICHMENT in needed:
        queries.append(_build_enrichment_query(resolver, conversation_ids))
    if SourceQuery.IO in needed:
        queries.append(_build_io_query(resolver, conversation_ids))

    with sentry_sdk.start_span(op="ai_conversations.bulk_rpc", name="Execute detail queries"):
        results = Spans.run_bulk_table_queries(queries) if queries else {}

    conversations = {conv_id: {CONVERSATION_ID: conv_id} for conv_id in conversation_ids}

    with sentry_sdk.start_span(op="ai_conversations.process", name="Process detail results"):
        if SourceQuery.AGGREGATES in needed:
            _apply_aggregates(conversations, results[SourceQuery.AGGREGATES.value], fields)
        if SourceQuery.ENRICHMENT in needed:
            _apply_enrichment(conversations, results[SourceQuery.ENRICHMENT.value], fields)
        if SourceQuery.IO in needed:
            _apply_io(conversations, results[SourceQuery.IO.value], fields)

    return [conversations[conv_id] for conv_id in conversation_ids if conv_id in conversations]


def _requested_columns(fields: list[str], source: SourceQuery) -> list[str]:
    """Union of EAP columns for the requested fields of a single source query."""
    columns: list[str] = ["gen_ai.conversation.id"]
    for field in fields:
        spec = FIELD_REGISTRY[field]
        if spec.source is not source:
            continue
        for column in spec.eap_columns:
            if column not in columns:
                columns.append(column)
    return columns


def _build_aggregates_query(
    resolver: SearchResolver, conversation_ids: list[str], fields: list[str]
) -> TableQuery:
    return TableQuery(
        name=SourceQuery.AGGREGATES.value,
        query_string=build_escaped_term_filter("gen_ai.conversation.id", conversation_ids),
        selected_columns=_requested_columns(fields, SourceQuery.AGGREGATES),
        orderby=None,
        offset=0,
        limit=len(conversation_ids),
        referrer=Referrer.API_AI_CONVERSATIONS_COMPLETE.value,
        sampling_mode="HIGHEST_ACCURACY",
        resolver=resolver,
    )


def _build_enrichment_query(resolver: SearchResolver, conversation_ids: list[str]) -> TableQuery:
    ids_filter = build_escaped_term_filter("gen_ai.conversation.id", conversation_ids)
    return TableQuery(
        name=SourceQuery.ENRICHMENT.value,
        query_string=f"{ids_filter} has:gen_ai.operation.type",
        selected_columns=list(_ENRICHMENT_COLUMNS),
        orderby=["timestamp"],
        offset=0,
        limit=_SCAN_LIMIT,
        referrer=Referrer.API_AI_CONVERSATIONS_ENRICHMENT.value,
        sampling_mode="HIGHEST_ACCURACY",
        resolver=resolver,
    )


def _build_io_query(resolver: SearchResolver, conversation_ids: list[str]) -> TableQuery:
    ids_filter = build_escaped_term_filter("gen_ai.conversation.id", conversation_ids)
    return TableQuery(
        name=SourceQuery.IO.value,
        query_string=f"{ids_filter} gen_ai.operation.type:ai_client",
        selected_columns=list(_IO_COLUMNS),
        orderby=["timestamp"],
        offset=0,
        limit=_SCAN_LIMIT,
        referrer=Referrer.API_AI_CONVERSATIONS_FIRST_LAST_IO.value,
        sampling_mode="HIGHEST_ACCURACY",
        resolver=resolver,
    )


def _extract_aggregate_value(field: str, row: dict[str, Any]) -> Any:
    if field == END_TIMESTAMP:
        return compute_timestamp_ms(row.get(_MAX_FINISH, 0))
    if field == START_TIMESTAMP:
        return compute_timestamp_ms(row.get(_MIN_START, 0))
    if field == DURATION:
        start_ms = compute_timestamp_ms(row.get(_MIN_START, 0))
        end_ms = compute_timestamp_ms(row.get(_MAX_FINISH, 0))
        return max(0, end_ms - start_ms)
    if field == ERRORS:
        return int(row.get(_FAILURE_COUNT) or 0)
    if field == LLM_CALLS:
        return int(row.get(_COUNT_AI_CLIENT) or 0)
    if field == TOOL_CALLS:
        return int(row.get(_COUNT_TOOL) or 0)
    if field == TOTAL_TOKENS:
        return int(row.get(_SUM_TOKENS) or 0)
    if field == TOTAL_COST:
        return float(row.get(_SUM_COST) or 0)
    if field == TRACE_COUNT:
        return int(row.get(_COUNT_UNIQUE_TRACE) or 0)
    if field == MODELS_USED:
        model = row.get(_ANY_MODEL)
        return [model] if model else []
    if field == USER:
        return build_user_response(
            user_id=row.get(_ANY_USER_ID),
            user_email=row.get(_ANY_USER_EMAIL),
            user_username=row.get(_ANY_USER_USERNAME),
            user_ip=row.get(_ANY_USER_IP),
        )
    raise ValueError(f"Unhandled aggregate field: {field}")


def _apply_aggregates(
    conversations: dict[str, dict[str, Any]], aggregates: EAPResponse, fields: list[str]
) -> None:
    aggregate_fields = [
        field for field in fields if FIELD_REGISTRY[field].source is SourceQuery.AGGREGATES
    ]
    for row in aggregates.get("data", []):
        conversation = conversations.get(row.get("gen_ai.conversation.id", ""))
        if conversation is None:
            continue
        for field in aggregate_fields:
            conversation[field] = _extract_aggregate_value(field, row)


def _apply_enrichment(
    conversations: dict[str, dict[str, Any]], enrichment: EAPResponse, fields: list[str]
) -> None:
    requested = {
        field for field in fields if FIELD_REGISTRY[field].source is SourceQuery.ENRICHMENT
    }

    flows: dict[str, list[str]] = defaultdict(list)
    traces: dict[str, set[str]] = defaultdict(set)
    tool_names: dict[str, set[str]] = defaultdict(set)
    tool_errors: dict[str, int] = defaultdict(int)

    for row in enrichment.get("data", []):
        conv_id = row.get("gen_ai.conversation.id", "")
        if not conv_id:
            continue

        if TRACE_IDS in requested:
            trace_id = row.get("trace", "")
            if trace_id:
                traces[conv_id].add(trace_id)

        operation_type = row.get("gen_ai.operation.type")
        if FLOW in requested and operation_type == "invoke_agent":
            agent_name = row.get("gen_ai.agent.name", "")
            if agent_name:
                flows[conv_id].append(agent_name)

        if operation_type == "tool":
            if TOOL_NAMES in requested:
                tool_name = row.get("gen_ai.tool.name")
                if tool_name:
                    tool_names[conv_id].add(tool_name)
            if TOOL_ERRORS in requested:
                status = row.get("span.status", "ok")
                if status and status not in NON_FAILURE_STATUS:
                    tool_errors[conv_id] += 1

    for conv_id, conversation in conversations.items():
        if FLOW in requested:
            conversation[FLOW] = flows.get(conv_id, [])
        if TRACE_IDS in requested:
            conversation[TRACE_IDS] = list(traces.get(conv_id, set()))
        if TOOL_NAMES in requested:
            conversation[TOOL_NAMES] = sorted(tool_names.get(conv_id, set()))
        if TOOL_ERRORS in requested:
            conversation[TOOL_ERRORS] = tool_errors.get(conv_id, 0)


def _apply_io(conversations: dict[str, dict[str, Any]], io: EAPResponse, fields: list[str]) -> None:
    requested = {field for field in fields if FIELD_REGISTRY[field].source is SourceQuery.IO}

    first_input: dict[str, str] = {}
    last_output: dict[str, tuple[float, str]] = {}

    for row in io.get("data", []):
        conv_id = row.get("gen_ai.conversation.id", "")
        if not conv_id:
            continue

        if FIRST_INPUT in requested and conv_id not in first_input:
            content = get_first_input_message(row)
            if content:
                first_input[conv_id] = content

        if LAST_OUTPUT in requested:
            content = get_last_output(row)
            if content:
                ts = to_timestamp_float(row.get("timestamp"))
                current = last_output.get(conv_id)
                if current is None or ts > current[0]:
                    last_output[conv_id] = (ts, content)

    for conv_id, conversation in conversations.items():
        if FIRST_INPUT in requested:
            conversation[FIRST_INPUT] = first_input.get(conv_id)
        if LAST_OUTPUT in requested:
            entry = last_output.get(conv_id)
            conversation[LAST_OUTPUT] = entry[1] if entry else None


__all__ = [
    "get_conversations_columns",
    "resolve_requested_fields",
    "resolve_sort",
]
