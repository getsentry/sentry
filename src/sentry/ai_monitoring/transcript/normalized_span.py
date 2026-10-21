"""Structured source-span expansion for the transcript API."""

import json  # noqa: S003
from collections.abc import Mapping
from typing import Any, TypedDict

from sentry.ai_monitoring.message_normalizer import (
    AIMessage,
    extract_assistant_output,
    normalize_to_messages,
)


class NormalizedAISpan(TypedDict):
    spanId: str
    traceId: str
    projectId: str
    inputMessages: list[AIMessage] | None
    systemInstructions: list[AIMessage] | None
    responseText: str | None
    reasoning: str | None
    responseObject: Any
    toolCalls: Any
    toolName: str | None
    toolArguments: Any
    toolResult: Any
    status: str | None
    errors: list[dict[str, Any]]


def _structured(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    try:
        return json.loads(value)
    except (ValueError, RecursionError):
        return value


def normalize_ai_span(row: Mapping[str, Any]) -> NormalizedAISpan:
    """Normalize supported AI attributes without discarding unsupported raw payloads."""
    output = extract_assistant_output(row.get("gen_ai.output.messages"), "assistant")
    response_object = output["response_object"] or row.get("gen_ai.response.object")
    return {
        "spanId": str(row["span_id"]),
        "traceId": str(row.get("trace") or ""),
        "projectId": str(row.get("project.id") or ""),
        "inputMessages": normalize_to_messages(
            row.get("gen_ai.input.messages") or row.get("gen_ai.request.messages"), "user"
        ),
        "systemInstructions": normalize_to_messages(
            row.get("gen_ai.system_instructions"), "system"
        ),
        "responseText": output["response_text"],
        "reasoning": output["reasoning_text"],
        "responseObject": _structured(response_object),
        "toolCalls": _structured(output["tool_calls"]),
        "toolName": row.get("gen_ai.tool.name"),
        "toolArguments": _structured(row.get("gen_ai.tool.call.arguments")),
        "toolResult": _structured(
            row.get("gen_ai.tool.call.result") or row.get("anthropic.tool_result.content")
        ),
        "status": row.get("span.status"),
        "errors": row.get("errors") or [],
    }
