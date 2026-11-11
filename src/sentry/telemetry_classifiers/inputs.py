from __future__ import annotations

from collections.abc import Sequence

from sentry.telemetry_classifiers.types import InputSpec, Message, PreparedInput


def prepare_input(
    messages: Sequence[Message],
    spec: InputSpec,
    *,
    source_truncated: bool,
) -> PreparedInput:
    """Bound oldest-first messages to a classifier model's input allowance, keeping the newest content.

    Messages with roles the model doesn't accept, or with no text, are left out. When the
    allowance runs out partway through a message, that message keeps only its end. The result has
    no messages when nothing usable remains; callers record that as a skip.
    """
    usable = [
        message for message in messages if message.role in spec.roles and message.content.strip()
    ]

    kept: list[Message] = []
    remaining = spec.max_chars
    input_truncated = False
    for message in reversed(usable):
        if remaining <= 0:
            input_truncated = True
            break
        content = message.content
        if len(content) > remaining:
            content = content[-remaining:]
            input_truncated = True
        kept.append(Message(role=message.role, content=content))
        remaining -= len(content)

    kept.reverse()
    return PreparedInput(
        messages=tuple(kept),
        input_truncated=input_truncated,
        source_truncated=source_truncated,
    )
