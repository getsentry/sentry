import re
from collections.abc import Mapping
from datetime import datetime
from typing import Any, TypedDict
from urllib.parse import quote, urlencode

from sentry.ai_monitoring.message_normalizer import (
    FILTERED,
    extract_assistant_output,
    normalize_to_messages,
    stringify_message_content,
)
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.relay.config.ai_model_costs import AIModelCost, AIModelMetadataConfig


class ConversationProject(TypedDict):
    id: int
    name: str
    slug: str


def serialize_conversation_project(project: Project) -> ConversationProject:
    return {"id": project.id, "name": project.name, "slug": project.slug}


def get_conversation_url(
    organization: Organization,
    conversation_id: str,
    project_id: int | None = None,
) -> str:
    query = urlencode({"project": project_id}) if project_id is not None else None
    return organization.absolute_url(
        f"/organizations/{organization.slug}/explore/agents/conversations/"
        f"{quote(conversation_id, safe='')}/",
        query=query,
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


def _extract_last_assistant_message(messages: Any) -> str | None:
    if messages == FILTERED:
        return FILTERED

    # Agent spans record every assistant step of a turn, so only the final one
    # is the turn's output.
    for message in reversed(normalize_to_messages(messages, "assistant") or []):
        if message.get("role") == "assistant":
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
    return (
        input_message
        or request_message
        or _extract_first_user_message(row.get("agent_input_messages"))
    )


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
    return output or response or _extract_last_assistant_message(row.get("agent_output_messages"))


def normalize_model_id(model_id: str) -> str:
    """
    Normalize a model id by removing dates and versions.
    Example:
    - "gpt-4" -> "gpt-4"
    - "gpt-4-20241022" -> "gpt-4"
    - "gpt-4-v1.0" -> "gpt-4"
    - "gpt-4-20241022-v1.0" -> "gpt-4"
    - "gpt-4-20241022-v1.0-beta" -> "gpt-4"
    - "gpt-4-20241022-v1.0-beta-1" -> "gpt-4"

    Args:
        model_id: The model id to normalize

    Returns:
        The normalized model id
    """
    return re.sub(
        r"(([-_@])(\d{4}[-/.]\d{2}[-/.]\d{2}|\d{8}))?([-_]v\d+[:.]?\d*([-:].*)?)?$", "", model_id
    )


def prefix_glob_model_name(model_id: str) -> str:
    """
    Create a glob version of a model name by adding a wildcard prefix.

    This handles cases where models have random prefixes before the actual model name.
    Can be used on both regular model IDs and suffix-globbed model names.

    Examples:
    - "gpt-4" -> "*gpt-4"
    - "claude-3-5-sonnet" -> "*claude-3-5-sonnet"
    - "o3-pro" -> "*o3-pro"

    Args:
        model_id: The original model ID or a suffix-globbed model name

    Returns:
        The glob version with a wildcard prefix
    """
    # Simply prepend * to the model name
    return f"*{model_id}"


def canonical_model_name(model_id: str) -> str:
    """Reduce a model id to the model's own name, the same whichever gateway or
    cloud reported it.

    Strips a namespace (``anthropic/``, ``models/``), Bedrock's region and vendor
    (``us.anthropic.``), a snapshot date or version, and spells versions with
    dashes the way providers do where OpenRouter uses dots (``4.5``).
    """
    name = normalize_model_id(_unqualified_model_name(model_id))
    return re.sub(r"(?<=\d)\.(?=\d)", "-", name)


def _unqualified_model_name(model_id: str) -> str:
    name = model_id.lower().rsplit("/", 1)[-1]
    return re.sub(r"^(?:[a-z]+\.)+", "", name)


def model_costs(model_id: str, config: AIModelMetadataConfig) -> AIModelCost | None:
    """Look up per-token prices for a model reported on a span.

    Spans carry provider-specific model names, so the lookup narrows the
    reported id towards how the metadata is keyed: as reported, with dates and
    versions stripped, then again without the namespace a gateway prefixes
    (``anthropic/claude-sonnet-4``), which the metadata keys without, then
    lowercased and without Bedrock's region and vendor, and finally as the
    canonical name. Exact spellings go first because a dated snapshot can be
    priced apart from its model, and OpenRouter keys keep dotted versions.

    The metadata also holds a ``*``-prefixed key per model, which is there for
    relay to glob-match against and is not useful here: it is only ever added
    alongside the bare key, so a dict lookup on it can never find a model the
    bare key missed.

    Returns None when the model is unknown.
    """
    models = config.get("models") or {}
    bare_model_id = model_id.rsplit("/", 1)[-1]
    unqualified_model_name = _unqualified_model_name(model_id)
    for key in (
        model_id,
        normalize_model_id(model_id),
        bare_model_id,
        normalize_model_id(bare_model_id),
        unqualified_model_name,
        normalize_model_id(unqualified_model_name),
        canonical_model_name(model_id),
    ):
        metadata = models.get(key)
        if metadata is not None:
            return metadata.get("costs")
    return None
