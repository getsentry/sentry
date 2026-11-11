from __future__ import annotations

from collections.abc import Sequence

from sentry.telemetry_classifiers.constants import MAX_INPUT_CHARS
from sentry.telemetry_classifiers.types import Message, PreparedInput


def prepare_messages(messages: Sequence[Message]) -> PreparedInput:
    """Keep the newest user messages that fit in MAX_INPUT_CHARS, oldest first.

    Other roles and blank messages are left out first, so they don't use the limit. A message cut
    partway keeps its end. The result has no messages when there's no user text to classify.
    """
    usable = [message for message in messages if message.role == "user" and message.content.strip()]

    kept: list[Message] = []
    remaining = MAX_INPUT_CHARS
    truncated = False
    for message in reversed(usable):
        if remaining <= 0:
            truncated = True
            break
        content = message.content
        if len(content) > remaining:
            content = content[-remaining:]
            truncated = True
        kept.append(Message(role=message.role, content=content))
        remaining -= len(content)

    kept.reverse()
    return PreparedInput(messages=tuple(kept), truncated=truncated)
