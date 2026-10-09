from collections.abc import Mapping
from typing import Any, TypedDict

from sentry.ai_monitoring.utils import timestamp_to_float


class AIConversationAggregates(TypedDict):
    endTimestamp: int
    errors: int
    generationDuration: float
    inputTokens: int
    llmCalls: int
    outputTokens: int
    startTimestamp: int
    toolCalls: int
    toolErrors: int
    toolNames: list[str]
    totalCost: float
    totalTokens: int


CONVERSATION_AGGREGATE_DEFINITIONS = {
    "endTimestamp": ("max(timestamp)", "end_timestamp"),
    "errors": ("failure_count()", "errors"),
    "generationDuration": (
        "sum_if(`gen_ai.operation.type:ai_client`,span.duration)",
        "generation_duration",
    ),
    "inputTokens": (
        "sum_if(`gen_ai.operation.type:ai_client`,gen_ai.usage.input_tokens)",
        "input_tokens",
    ),
    "llmCalls": ("count_if(`gen_ai.operation.type:ai_client`)", "llm_calls"),
    "outputTokens": (
        "sum_if(`gen_ai.operation.type:ai_client`,gen_ai.usage.output_tokens)",
        "output_tokens",
    ),
    "startTimestamp": ("min(timestamp)", "start_timestamp"),
    "toolCalls": ("count_if(`gen_ai.operation.type:tool`)", "tool_calls"),
    "toolErrors": ("failure_count_if(gen_ai.operation.type,equals,tool)", "tool_errors"),
    "toolNames": (
        "collect_unique_if(`gen_ai.operation.type:tool`,gen_ai.tool.name)",
        "tool_names",
    ),
    "totalCost": (
        "sum_if(`gen_ai.operation.type:ai_client`,gen_ai.cost.total_tokens)",
        "total_cost",
    ),
    "totalTokens": (
        "sum_if(`gen_ai.operation.type:ai_client`,gen_ai.usage.total_tokens)",
        "total_tokens",
    ),
}

CONVERSATION_AGGREGATE_COLUMNS = [
    f"{expression} as {alias}" for expression, alias in CONVERSATION_AGGREGATE_DEFINITIONS.values()
]


def parse_conversation_aggregates(row: Mapping[str, Any]) -> AIConversationAggregates:
    return {
        "endTimestamp": int(timestamp_to_float(row.get("end_timestamp")) * 1000),
        "errors": int(row.get("errors") or 0),
        "generationDuration": float(row.get("generation_duration") or 0),
        "inputTokens": int(row.get("input_tokens") or 0),
        "llmCalls": int(row.get("llm_calls") or 0),
        "outputTokens": int(row.get("output_tokens") or 0),
        "startTimestamp": int(timestamp_to_float(row.get("start_timestamp")) * 1000),
        "toolCalls": int(row.get("tool_calls") or 0),
        "toolErrors": int(row.get("tool_errors") or 0),
        "toolNames": sorted(row.get("tool_names") or []),
        "totalCost": float(row.get("total_cost") or 0),
        "totalTokens": int(row.get("total_tokens") or 0),
    }
