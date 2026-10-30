"""Conservative message-history evidence, independent of rendered text.

Only adjacent generations in the same scope are compared. Without stable IDs,
continuation requires either growing input history without a new user message, or
an exact prefix containing the previous captured input and response. Comparing
input history directly accommodates providers that encode assistant output and
input differently. Equal text and unchanged snapshots alone are not proof.
"""

import hashlib
import json  # noqa: S003
import math
from dataclasses import dataclass, field

from sentry.ai_monitoring.message_normalizer import _parse_attribute
from sentry.ai_monitoring.transcript.models import TranscriptSpan


@dataclass(frozen=True, slots=True)
class CapturedMessage:
    role: str
    identifier: str | None = field(repr=False)
    signature: str = field(repr=False)


@dataclass(frozen=True, slots=True)
class GenerationCapture:
    inputs: tuple[CapturedMessage, ...] | None
    outputs: tuple[CapturedMessage, ...] | None
    started_at: float
    finished_at: float

    @property
    def needs_previous(self) -> bool:
        return bool(
            self.inputs
            and (len(self.inputs) > 1 or any(message.identifier for message in self.inputs))
            or self.outputs
            and all(message.identifier for message in self.outputs)
        )


def _is_json(value: object) -> bool:
    if value is None or isinstance(value, (str, bool, int)):
        return True
    if isinstance(value, float):
        return math.isfinite(value)
    if isinstance(value, list):
        return all(_is_json(item) for item in value)
    if isinstance(value, dict):
        return all(isinstance(key, str) and _is_json(item) for key, item in value.items())
    return False


def _capture(raw: object, default_role: str) -> tuple[CapturedMessage, ...] | None:
    parsed = _parse_attribute(raw)
    if isinstance(parsed, str):
        if not parsed.strip() or parsed in ("[Filtered]", "(no value)", "<not reported>"):
            return None
        parsed = [{"role": default_role, "content": parsed}]
    if isinstance(parsed, dict):
        parsed = parsed.get("messages", [parsed])
    if not isinstance(parsed, list) or not parsed:
        return None
    result = []
    for message in parsed:
        if not isinstance(message, dict) or not isinstance(role := message.get("role"), str):
            return None
        if role not in ("user", "assistant", "tool", "system", "developer"):
            return None
        if not any(key in message for key in ("content", "parts", "tool_calls")):
            return None
        try:
            if not _is_json(message):
                return None
            encoded = json.dumps(message, sort_keys=True, separators=(",", ":"), allow_nan=False)
        except RecursionError:
            # History evidence is optional; deeply nested metadata must not hide readable content.
            return None
        identifier = message.get("id")
        result.append(
            CapturedMessage(
                role,
                identifier if isinstance(identifier, str) and identifier else None,
                hashlib.sha256(encoded.encode()).hexdigest(),
            )
        )
    return tuple(result)


def capture_generation(span: TranscriptSpan) -> GenerationCapture:
    attributes = span.attributes
    return GenerationCapture(
        _capture(
            attributes.get("gen_ai.input.messages") or attributes.get("gen_ai.request.messages"),
            "user",
        ),
        _capture(
            attributes.get("gen_ai.output.messages") or attributes.get("gen_ai.response.text"),
            "assistant",
        ),
        span.start_timestamp,
        span.end_timestamp,
    )


def is_user_history_continuation(
    current: GenerationCapture, previous: GenerationCapture | None
) -> bool:
    if previous is None or not current.inputs or not previous.inputs:
        return False
    last_user = next(
        (
            index
            for index in reversed(range(len(current.inputs)))
            if current.inputs[index].role == "user"
        ),
        None,
    )
    if last_user is None:
        return False
    user = current.inputs[last_user]
    if user.identifier and any(message == user for message in previous.inputs):
        return True
    if previous.finished_at > current.started_at:
        return False
    if (
        len(current.inputs) > len(previous.inputs)
        and current.inputs[: len(previous.inputs)] == previous.inputs
        and last_user < len(previous.inputs)
    ):
        return True
    if not previous.outputs or any(message.role != "assistant" for message in previous.outputs):
        return False
    observed = previous.inputs + previous.outputs
    return last_user < len(observed) and current.inputs[: len(observed)] == observed


def is_duplicate_assistant_message(
    current: GenerationCapture, previous: GenerationCapture | None
) -> bool:
    # A reused response ID does not collapse an answer to a new user turn.
    if (
        current.inputs
        and any(message.role == "user" for message in current.inputs)
        and not is_user_history_continuation(current, previous)
    ):
        return False
    return bool(
        previous is not None
        and current.outputs
        and previous.outputs
        and all(message.identifier and message.role == "assistant" for message in current.outputs)
        and current.outputs == previous.outputs
    )
