"""Legacy fixed-shape implementation of the AI Conversations table.

This is the behavior used when ``organizations:gen-ai-conversations-columns`` is
off: a fixed set of columns is always computed and returned for every row. The
selectable-column behavior lives in :mod:`ai_conversations_columns`.

TODO: remove this module (and the flag branch in the endpoint) once
``organizations:gen-ai-conversations-columns`` has fully rolled out.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

import sentry_sdk

from sentry.api.helpers.ai_conversations_shared import (
    UserResponse,
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

_BASE_FILTER = (
    "has:gen_ai.conversation.id"
    " (has:gen_ai.input.messages OR has:gen_ai.request.messages)"
    " (has:gen_ai.output.messages OR has:gen_ai.response.text)"
)


def _build_conversation_query(base_query: str, user_query: str) -> str:
    if user_query and user_query.strip():
        return f"{base_query} {user_query.strip()}"
    return base_query


def _extract_conversation_ids(results: EAPResponse) -> list[str]:
    return [
        conv_id for row in results.get("data", []) if (conv_id := row.get("gen_ai.conversation.id"))
    ]


def _build_conversation_response(
    conv_id: str,
    start_timestamp: int,
    end_timestamp: int,
    errors: int,
    llm_calls: int,
    tool_calls: int,
    total_tokens: int,
    total_cost: float,
    trace_ids: list[str],
    flow: list[str],
    first_input: str | None,
    last_output: str | None,
    user: dict[str, str | None] | None = None,
    tool_names: list[str] | None = None,
    tool_errors: int = 0,
) -> dict[str, Any]:
    return {
        "conversationId": conv_id,
        "flow": flow,
        "errors": errors,
        "llmCalls": llm_calls,
        "toolCalls": tool_calls,
        "totalTokens": total_tokens,
        "totalCost": total_cost,
        "startTimestamp": start_timestamp,
        "endTimestamp": end_timestamp,
        "traceCount": len(trace_ids),
        "traceIds": trace_ids,
        "firstInput": first_input,
        "lastOutput": last_output,
        "user": user,
        "toolNames": tool_names or [],
        "toolErrors": tool_errors,
    }


@sentry_sdk.trace
def get_conversations(
    snuba_params: SnubaParams,
    *,
    offset: int,
    limit: int,
    user_query: str,
    sampling_mode: SAMPLING_MODES = "NORMAL",
) -> list[dict[str, Any]]:
    query_string = _build_conversation_query(_BASE_FILTER, user_query)

    conversation_ids_results = _fetch_conversation_ids(
        snuba_params, query_string, offset, limit, sampling_mode
    )
    conversation_ids = _extract_conversation_ids(conversation_ids_results)

    sentry_sdk.set_tag("ai_conversations.count", len(conversation_ids))
    sentry_sdk.set_attribute("ai_conversations.count", len(conversation_ids))

    if not conversation_ids:
        return []

    return _get_conversations_data(snuba_params, conversation_ids)


@sentry_sdk.trace
def _fetch_conversation_ids(
    snuba_params: SnubaParams,
    query_string: str,
    offset: int,
    limit: int,
    sampling_mode: SAMPLING_MODES,
) -> EAPResponse:
    return Spans.run_table_query(
        params=snuba_params,
        query_string=query_string,
        selected_columns=["gen_ai.conversation.id", "max(precise.finish_ts)"],
        orderby=["-max(precise.finish_ts)"],
        offset=offset,
        limit=limit,
        referrer=Referrer.API_AI_CONVERSATIONS.value,
        config=SearchResolverConfig(auto_fields=True),
        sampling_mode=sampling_mode,
    )


@sentry_sdk.trace
def _get_conversations_data(
    snuba_params: SnubaParams, conversation_ids: list[str]
) -> list[dict[str, Any]]:
    resolver = Spans.get_resolver(snuba_params, SearchResolverConfig(auto_fields=True))

    queries = [
        _build_aggregations_query(resolver, conversation_ids),
        _build_enrichment_query(resolver, conversation_ids),
        _build_first_last_io_query(resolver, conversation_ids),
    ]

    with sentry_sdk.start_span(op="ai_conversations.bulk_rpc", name="Execute bulk table queries"):
        results = Spans.run_bulk_table_queries(queries)

    with sentry_sdk.start_span(op="ai_conversations.process", name="Process query results"):
        conversations_map = _build_conversations_from_aggregations(results["aggregations"])
        _apply_enrichment(conversations_map, results["enrichment"])
        _apply_first_last_io(conversations_map, results["first_last_io"])

    return [
        conversations_map[conv_id] for conv_id in conversation_ids if conv_id in conversations_map
    ]


def _build_aggregations_query(resolver: SearchResolver, conversation_ids: list[str]) -> TableQuery:
    return TableQuery(
        name="aggregations",
        query_string=build_escaped_term_filter("gen_ai.conversation.id", conversation_ids),
        selected_columns=[
            "gen_ai.conversation.id",
            "failure_count()",
            "count_if(gen_ai.operation.type,equals,ai_client)",
            "count_if(gen_ai.operation.type,equals,tool)",
            "sum_if(gen_ai.usage.total_tokens,gen_ai.operation.type,equals,ai_client)",
            "sum_if(gen_ai.cost.total_tokens,gen_ai.operation.type,equals,ai_client)",
            "min(precise.start_ts)",
            "max(precise.finish_ts)",
        ],
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
        name="enrichment",
        query_string=f"{ids_filter} has:gen_ai.operation.type",
        selected_columns=[
            "gen_ai.conversation.id",
            "gen_ai.operation.type",
            "gen_ai.agent.name",
            "gen_ai.tool.name",
            "span.status",
            "trace",
            "timestamp",
            "user.id",
            "user.email",
            "user.username",
            "user.ip",
        ],
        orderby=["timestamp"],
        offset=0,
        limit=10000,
        referrer=Referrer.API_AI_CONVERSATIONS_ENRICHMENT.value,
        sampling_mode="HIGHEST_ACCURACY",
        resolver=resolver,
    )


def _build_first_last_io_query(resolver: SearchResolver, conversation_ids: list[str]) -> TableQuery:
    ids_filter = build_escaped_term_filter("gen_ai.conversation.id", conversation_ids)
    return TableQuery(
        name="first_last_io",
        query_string=f"{ids_filter} gen_ai.operation.type:ai_client",
        selected_columns=[
            "gen_ai.conversation.id",
            "gen_ai.input.messages",
            "gen_ai.output.messages",
            "gen_ai.request.messages",
            "gen_ai.response.text",
            "timestamp",
        ],
        orderby=["timestamp"],
        offset=0,
        limit=10000,
        referrer=Referrer.API_AI_CONVERSATIONS_FIRST_LAST_IO.value,
        sampling_mode="HIGHEST_ACCURACY",
        resolver=resolver,
    )


def _build_conversations_from_aggregations(
    aggregations: EAPResponse,
) -> dict[str, dict[str, Any]]:
    with sentry_sdk.start_span(
        op="ai_conversations.build_from_aggregations",
        name="Build conversations from aggregations",
    ):
        conversations_map: dict[str, dict[str, Any]] = {}

        for row in aggregations.get("data", []):
            conv_id = row.get("gen_ai.conversation.id", "")
            start_ts = row.get("min(precise.start_ts)", 0)
            finish_ts = row.get("max(precise.finish_ts)", 0)

            conversations_map[conv_id] = _build_conversation_response(
                conv_id=conv_id,
                start_timestamp=compute_timestamp_ms(start_ts),
                end_timestamp=compute_timestamp_ms(finish_ts),
                errors=int(row.get("failure_count()") or 0),
                llm_calls=int(row.get("count_if(gen_ai.operation.type,equals,ai_client)") or 0),
                tool_calls=int(row.get("count_if(gen_ai.operation.type,equals,tool)") or 0),
                total_tokens=int(
                    row.get(
                        "sum_if(gen_ai.usage.total_tokens,gen_ai.operation.type,equals,ai_client)"
                    )
                    or 0
                ),
                total_cost=float(
                    row.get(
                        "sum_if(gen_ai.cost.total_tokens,gen_ai.operation.type,equals,ai_client)"
                    )
                    or 0
                ),
                trace_ids=[],
                flow=[],
                first_input=None,
                last_output=None,
            )

        return conversations_map


def _apply_enrichment(
    conversations_map: dict[str, dict[str, Any]], enrichment_data: EAPResponse
) -> None:
    with sentry_sdk.start_span(
        op="ai_conversations.apply_enrichment",
        name="Apply enrichment data",
    ) as span:
        enrichment_rows = enrichment_data.get("data", [])
        span.set_data("rows_count", len(enrichment_rows))

        flows_by_conversation: dict[str, list[str]] = defaultdict(list)
        traces_by_conversation: dict[str, set[str]] = defaultdict(set)
        tool_names_by_conversation: dict[str, set[str]] = defaultdict(set)
        tool_errors_by_conversation: dict[str, int] = defaultdict(int)
        # Track first user data per conversation (rows are sorted by timestamp).
        user_by_conversation: dict[str, UserResponse] = {}

        for row in enrichment_rows:
            conv_id = row.get("gen_ai.conversation.id", "")
            if not conv_id:
                continue

            trace_id = row.get("trace", "")
            if trace_id:
                traces_by_conversation[conv_id].add(trace_id)

            if row.get("gen_ai.operation.type") == "invoke_agent":
                agent_name = row.get("gen_ai.agent.name", "")
                if agent_name:
                    flows_by_conversation[conv_id].append(agent_name)

            if row.get("gen_ai.operation.type") == "tool":
                tool_name = row.get("gen_ai.tool.name")
                if tool_name:
                    tool_names_by_conversation[conv_id].add(tool_name)
                status = row.get("span.status", "ok")
                if status and status not in NON_FAILURE_STATUS:
                    tool_errors_by_conversation[conv_id] += 1

            # Capture user from the first span (earliest timestamp) per conversation.
            if conv_id not in user_by_conversation:
                user_data = build_user_response(
                    user_id=row.get("user.id"),
                    user_email=row.get("user.email"),
                    user_username=row.get("user.username"),
                    user_ip=row.get("user.ip"),
                )
                if user_data:
                    user_by_conversation[conv_id] = user_data

        for conv_id, conversation in conversations_map.items():
            traces = traces_by_conversation.get(conv_id, set())
            conversation["flow"] = flows_by_conversation.get(conv_id, [])
            conversation["traceIds"] = list(traces)
            conversation["traceCount"] = len(traces)
            conversation["user"] = user_by_conversation.get(conv_id)
            conversation["toolNames"] = sorted(tool_names_by_conversation.get(conv_id, set()))
            conversation["toolErrors"] = tool_errors_by_conversation.get(conv_id, 0)


def _apply_first_last_io(
    conversations_map: dict[str, dict[str, Any]], first_last_io_data: EAPResponse
) -> None:
    with sentry_sdk.start_span(
        op="ai_conversations.apply_first_last_io",
        name="Apply first/last IO data",
    ) as span:
        io_rows = first_last_io_data.get("data", [])
        span.set_data("rows_count", len(io_rows))

        first_input_by_conv: dict[str, str] = {}
        last_output_by_conv: dict[str, tuple[float, str]] = {}

        for row in io_rows:
            conv_id = row.get("gen_ai.conversation.id", "")
            if not conv_id:
                continue

            ts = to_timestamp_float(row.get("timestamp"))

            if conv_id not in first_input_by_conv:
                first_user_content = get_first_input_message(row)
                if first_user_content:
                    first_input_by_conv[conv_id] = first_user_content

            output_content = get_last_output(row)
            if output_content:
                current = last_output_by_conv.get(conv_id)
                if current is None or ts > current[0]:
                    last_output_by_conv[conv_id] = (ts, output_content)

        for conv_id, conversation in conversations_map.items():
            conversation["firstInput"] = first_input_by_conv.get(conv_id)
            last_tuple = last_output_by_conv.get(conv_id)
            conversation["lastOutput"] = last_tuple[1] if last_tuple else None
