"""Shared helpers for the AI conversation endpoints.

Keeping the aggregation columns and time-window resolution in one place ensures the
list, details, and summary endpoints compute the same per-conversation numbers.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import replace
from datetime import datetime, timedelta
from typing import Any, TypedDict

from sentry.search.eap.occurrences.query_utils import build_escaped_term_filter
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.constants import NON_FAILURE_STATUS
from sentry.search.events.types import SnubaParams
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans
from sentry.utils.dates import parse_stats_period

MAX_RETENTION_DAYS = 30

WIDENING_STEPS = [timedelta(days=7), timedelta(days=14), timedelta(days=MAX_RETENTION_DAYS)]

# Per-conversation aggregates. Token/cost usage lives on ai_client spans, so those
# metrics are summed only over ai_client spans. The result key returned by the EAP RPC
# is the column expression itself, so query columns and parsing share these constants.
_ERRORS = "failure_count()"
_LLM_CALLS = "count_if(gen_ai.operation.type,equals,ai_client)"
_TOOL_CALLS = "count_if(gen_ai.operation.type,equals,tool)"
_TOTAL_TOKENS = "sum_if(gen_ai.usage.total_tokens,gen_ai.operation.type,equals,ai_client)"
_INPUT_TOKENS = "sum_if(gen_ai.usage.input_tokens,gen_ai.operation.type,equals,ai_client)"
_OUTPUT_TOKENS = "sum_if(gen_ai.usage.output_tokens,gen_ai.operation.type,equals,ai_client)"
_TOTAL_COST = "sum_if(gen_ai.cost.total_tokens,gen_ai.operation.type,equals,ai_client)"

AI_CONVERSATION_AGGREGATION_COLUMNS = [
    _ERRORS,
    _LLM_CALLS,
    _TOOL_CALLS,
    _TOTAL_TOKENS,
    _INPUT_TOKENS,
    _OUTPUT_TOKENS,
    _TOTAL_COST,
]


class ConversationAggregates(TypedDict):
    errors: int
    llmCalls: int
    toolCalls: int
    totalTokens: int
    inputTokens: int
    outputTokens: int
    totalCost: float


def parse_conversation_aggregates(row: dict[str, Any]) -> ConversationAggregates:
    """Parse a single EAP aggregation row (see ``AI_CONVERSATION_AGGREGATION_COLUMNS``)."""
    return {
        "errors": int(row.get(_ERRORS) or 0),
        "llmCalls": int(row.get(_LLM_CALLS) or 0),
        "toolCalls": int(row.get(_TOOL_CALLS) or 0),
        "totalTokens": int(row.get(_TOTAL_TOKENS) or 0),
        "inputTokens": int(row.get(_INPUT_TOKENS) or 0),
        "outputTokens": int(row.get(_OUTPUT_TOKENS) or 0),
        "totalCost": float(row.get(_TOTAL_COST) or 0),
    }


class UserResponse(TypedDict):
    id: str | None
    email: str | None
    username: str | None
    ip_address: str | None


def build_user_response(
    user_id: str | None,
    user_email: str | None,
    user_username: str | None,
    user_ip: str | None,
) -> UserResponse | None:
    """Build a user object, returning None when no user data is available."""
    if not any([user_id, user_email, user_username, user_ip]):
        return None
    return {
        "id": user_id,
        "email": user_email,
        "username": user_username,
        "ip_address": user_ip,
    }


# Per-span columns used to derive the conversation's user, tool names, agent flow, and
# traces. Ordered by timestamp so the earliest span wins when picking the user.
AI_CONVERSATION_ENRICHMENT_COLUMNS = [
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
]


class ConversationEnrichment(TypedDict):
    user: UserResponse | None
    toolNames: list[str]
    erroredToolNames: list[str]
    toolErrors: int
    flow: list[str]
    traceIds: list[str]


def extract_conversation_enrichment(rows: Iterable[dict[str, Any]]) -> ConversationEnrichment:
    """Derive a single conversation's enrichment from its spans (timestamp-ascending)."""
    flow: list[str] = []
    trace_ids: set[str] = set()
    tool_names: set[str] = set()
    errored_tool_names: set[str] = set()
    tool_errors = 0
    user: UserResponse | None = None

    for row in rows:
        trace_id = row.get("trace", "")
        if trace_id:
            trace_ids.add(trace_id)

        operation_type = row.get("gen_ai.operation.type")
        if operation_type == "invoke_agent":
            agent_name = row.get("gen_ai.agent.name", "")
            if agent_name:
                flow.append(agent_name)

        if operation_type == "tool":
            tool_name = row.get("gen_ai.tool.name")
            if tool_name:
                tool_names.add(tool_name)
            status = row.get("span.status", "ok")
            if status and status not in NON_FAILURE_STATUS:
                tool_errors += 1
                if tool_name:
                    errored_tool_names.add(tool_name)

        # Capture the user from the first span (earliest timestamp) that carries one.
        if user is None:
            user = build_user_response(
                row.get("user.id"),
                row.get("user.email"),
                row.get("user.username"),
                row.get("user.ip"),
            )

    return {
        "user": user,
        "toolNames": sorted(tool_names),
        "erroredToolNames": sorted(errored_tool_names),
        "toolErrors": tool_errors,
        "flow": flow,
        "traceIds": list(trace_ids),
    }


class ToolSummary(TypedDict):
    name: str
    hasError: bool


def build_tool_summaries(enrichment: ConversationEnrichment) -> list[ToolSummary]:
    """Pair each distinct tool name with whether any of its spans errored."""
    errored = set(enrichment["erroredToolNames"])
    return [{"name": name, "hasError": name in errored} for name in enrichment["toolNames"]]


class ConversationSummary(ConversationAggregates):
    user: UserResponse | None
    tools: list[ToolSummary]


def retention_window_error(snuba_params: SnubaParams, now: datetime) -> str | None:
    """Return an error message if the requested range predates retention, else None."""
    cutoff = now - timedelta(days=MAX_RETENTION_DAYS)
    if snuba_params.start and snuba_params.start < cutoff:
        return f"start time cannot be older than {MAX_RETENTION_DAYS} days"
    if snuba_params.end and snuba_params.end < cutoff:
        return f"end time cannot be older than {MAX_RETENTION_DAYS} days"
    return None


def build_widening_params(
    base_params: SnubaParams, stats_period: str | None, now: datetime
) -> list[SnubaParams]:
    max_retention = timedelta(days=MAX_RETENTION_DAYS)
    requested_delta: timedelta | None = parse_stats_period(stats_period) if stats_period else None

    steps: list[timedelta] = []
    if requested_delta and requested_delta < max_retention:
        steps.append(requested_delta)
    for step in WIDENING_STEPS:
        if not steps or step > steps[-1]:
            steps.append(step)

    return [replace(base_params, start=now - delta, end=now) for delta in steps]


def conversation_exists(snuba_params: SnubaParams, conversation_id: str) -> bool:
    result = Spans.run_table_query(
        params=snuba_params,
        query_string=build_escaped_term_filter("gen_ai.conversation.id", [conversation_id]),
        selected_columns=["span_id"],
        orderby=None,
        offset=0,
        limit=1,
        referrer=Referrer.API_AI_CONVERSATION_DETAILS.value,
        config=SearchResolverConfig(auto_fields=True),
        sampling_mode="HIGHEST_ACCURACY",
    )
    return bool(result.get("data"))


def resolve_conversation_time_window(
    base_params: SnubaParams,
    stats_period: str | None,
    now: datetime,
    conversation_id: str,
) -> SnubaParams:
    """Probe progressively wider windows to find which one contains the conversation."""
    candidates = build_widening_params(base_params, stats_period, now)
    for params in candidates:
        if conversation_exists(params, conversation_id):
            return params
    return candidates[-1]
