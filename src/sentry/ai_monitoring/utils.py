from collections.abc import Mapping
from datetime import datetime
from typing import Any

from sentry.ai_monitoring.message_normalizer import (
    FILTERED,
    extract_assistant_output,
    normalize_to_messages,
    stringify_message_content,
)


def timestamp_to_float(value: Any) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    if hasattr(value, "timestamp"):
        return value.timestamp()
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
        except ValueError:
            pass
    return 0.0


def _extract_first_user_message(messages: Any) -> str | None:
    if messages == FILTERED:
        return FILTERED

    for message in normalize_to_messages(messages, "user") or []:
        if message.get("role") == "user":
            return stringify_message_content(message.get("content"))
    return None


def get_first_input_message(row: Mapping[str, Any]) -> str | None:
    first_input = _extract_first_user_message(row.get("gen_ai.input.messages"))
    return first_input or _extract_first_user_message(row.get("gen_ai.request.messages"))


def get_last_output(row: Mapping[str, Any]) -> str | None:
    output_messages = row.get("gen_ai.output.messages")
    if output_messages:
        if output_messages == FILTERED:
            return FILTERED
        output = extract_assistant_output(output_messages, "assistant")["response_text"]
        if output:
            return output

    response_text = row.get("gen_ai.response.text")
    return response_text if isinstance(response_text, str) and response_text else None


def get_aggregated_first_input(row: Mapping[str, Any]) -> str | None:
    input_messages = row.get("input_messages")
    input_timestamp = timestamp_to_float(row.get("input_messages_timestamp"))
    request_messages = row.get("request_messages")
    request_timestamp = timestamp_to_float(row.get("request_messages_timestamp"))

    if (
        input_messages
        and input_timestamp
        and (not request_messages or not request_timestamp or input_timestamp <= request_timestamp)
    ):
        return _extract_first_user_message(input_messages)
    if request_messages and request_timestamp:
        return _extract_first_user_message(request_messages)
    return None


def get_aggregated_last_output(row: Mapping[str, Any]) -> str | None:
    output_messages = row.get("output_messages")
    output_timestamp = timestamp_to_float(row.get("output_messages_timestamp"))
    response_text = row.get("response_text")
    response_timestamp = timestamp_to_float(row.get("response_text_timestamp"))

    if (
        output_messages
        and output_timestamp
        and (not response_text or not response_timestamp or output_timestamp >= response_timestamp)
    ):
        if output_messages == FILTERED:
            return FILTERED
        return extract_assistant_output(output_messages, "assistant")["response_text"]
    if response_text and response_timestamp and isinstance(response_text, str):
        return response_text
    return None
