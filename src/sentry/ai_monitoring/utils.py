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
            content = stringify_message_content(message.get("content"))
            if content:
                return content
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
    input_timestamp = timestamp_to_float(row.get("input_messages_timestamp"))
    request_timestamp = timestamp_to_float(row.get("request_messages_timestamp"))
    input_message = (
        _extract_first_user_message(row.get("input_messages")) if input_timestamp else None
    )
    request_message = (
        _extract_first_user_message(row.get("request_messages")) if request_timestamp else None
    )

    if input_message and request_message:
        return input_message if input_timestamp <= request_timestamp else request_message
    return input_message or request_message


def get_aggregated_last_output(row: Mapping[str, Any]) -> str | None:
    output_timestamp = timestamp_to_float(row.get("output_messages_timestamp"))
    response_timestamp = timestamp_to_float(row.get("response_text_timestamp"))
    output_messages = row.get("output_messages")
    output = None
    if output_timestamp:
        if output_messages == FILTERED:
            output = FILTERED
        else:
            output = extract_assistant_output(output_messages, "assistant")["response_text"] or None
    response_text = row.get("response_text")
    response = (
        response_text
        if response_timestamp and isinstance(response_text, str) and response_text
        else None
    )

    if output and response:
        return output if output_timestamp >= response_timestamp else response
    return output or response
