"""Helpers shared between the AI Conversations endpoints.

Both the legacy fixed-shape endpoint and the column-selection endpoint extract
the same per-span values (user identity, message text, timestamps), so those
helpers live here and are imported by both.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, TypedDict

from sentry.utils.ai_message_normalizer import (
    FILTERED,
    extract_assistant_output,
    normalize_to_messages,
    stringify_message_content,
)


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
    """Build a user response object, returning None when no user data exists."""
    if not any([user_id, user_email, user_username, user_ip]):
        return None
    return {
        "id": user_id,
        "email": user_email,
        "username": user_username,
        "ip_address": user_ip,
    }


def to_timestamp_float(ts: Any) -> float:
    """Convert a timestamp to a float (seconds since epoch)."""
    if ts is None:
        return 0.0
    if isinstance(ts, (int, float)):
        return float(ts)
    if hasattr(ts, "timestamp"):
        return ts.timestamp()
    if isinstance(ts, str):
        try:
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            return dt.timestamp()
        except (ValueError, TypeError):
            return 0.0
    return 0.0


def compute_timestamp_ms(finish_ts: float) -> int:
    return int(finish_ts * 1000) if finish_ts else 0


def _extract_first_user_message(messages: Any) -> str | None:
    """Extract the first user message, handling both old and new formats."""
    if isinstance(messages, str) and messages == FILTERED:
        return FILTERED
    parsed = normalize_to_messages(messages, "user")
    if not parsed:
        return None
    for msg in parsed:
        if msg.get("role") == "user":
            content = stringify_message_content(msg.get("content"))
            if content:
                return content
    return None


def get_first_input_message(row: dict[str, Any]) -> str | None:
    """First user message from input attributes, in priority order.

    Priority: gen_ai.input.messages > gen_ai.request.messages
    """
    input_messages = row.get("gen_ai.input.messages")
    if input_messages:
        first_user = _extract_first_user_message(input_messages)
        if first_user:
            return first_user

    request_messages = row.get("gen_ai.request.messages")
    if request_messages:
        return _extract_first_user_message(request_messages)

    return None


def get_last_output(row: dict[str, Any]) -> str | None:
    """Output text from output attributes, in priority order.

    Priority: gen_ai.output.messages > gen_ai.response.text
    """
    output_messages = row.get("gen_ai.output.messages")
    if output_messages:
        if output_messages == FILTERED:
            return FILTERED
        text = extract_assistant_output(output_messages, "assistant")["response_text"]
        if text:
            return text

    response_text = row.get("gen_ai.response.text")
    if response_text:
        return response_text

    return None
