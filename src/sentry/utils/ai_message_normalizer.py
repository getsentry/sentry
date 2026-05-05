import json  # noqa: S003
from typing import Any, TypedDict

FILTERED = "[Filtered]"
FILE_CONTENT_PARTS = ("blob", "uri", "file")
_INVALID_JSON = object()


class AIMessage(TypedDict):
    role: str
    content: Any


class AIOutputResult(TypedDict):
    response_text: str | None
    response_object: str | None
    tool_calls: str | None


class RawMessage(TypedDict, total=False):
    role: str
    content: Any
    parts: list[Any]
    role_explicit: bool


class PartBuckets(TypedDict):
    has_renderable_text_part: bool
    text_parts: list[str]
    object_parts: list[Any]
    tool_calls: list[Any]
    tool_responses: list[dict[str, Any]]


# Keep this parser mirrored with
# static/app/views/insights/pages/agents/utils/aiMessageNormalizer.ts.
# AI SDKs emit inconsistent shapes and their specs keep changing, so update both
# parsers together whenever adding or changing a supported format.
def normalize_to_messages(raw: Any, default_role: str) -> list[AIMessage] | None:
    messages = _normalize_raw_messages(
        _raw_messages_from_attribute(raw, default_role), default_role
    )
    return messages or None


def extract_assistant_output(raw: Any, default_role: str) -> AIOutputResult:
    raw_messages = _raw_messages_from_attribute(raw, default_role)
    if not raw_messages:
        return _empty_output()

    selected = _select_assistant_messages(raw_messages)
    return _output_from_messages(selected)


def stringify_message_content(content: Any) -> str | None:
    if isinstance(content, str):
        return content or None

    try:
        return json.dumps(content)
    except TypeError:
        rendered = str(content)
        return rendered or None


def _empty_output() -> AIOutputResult:
    return {"response_text": None, "response_object": None, "tool_calls": None}


def _normalize_raw_messages(raw_messages: list[RawMessage], default_role: str) -> list[AIMessage]:
    normalized: list[AIMessage] = []
    for msg in raw_messages:
        role = msg.get("role") or default_role
        content = _resolve_message_content(msg, role)
        if content is None or content == "":
            continue
        normalized.append({"role": role, "content": content})
    return normalized


def _output_from_messages(messages: list[RawMessage]) -> AIOutputResult:
    text_parts: list[str] = []
    tool_call_parts: list[Any] = []
    object_parts: list[Any] = []
    for msg in messages:
        _append_output_from_message(
            msg,
            text_parts=text_parts,
            tool_call_parts=tool_call_parts,
            object_parts=object_parts,
        )

    response_object = None
    if object_parts:
        response_object = json.dumps(object_parts[0] if len(object_parts) == 1 else object_parts)

    return {
        "response_text": "\n".join(text_parts) if text_parts else None,
        "response_object": response_object,
        "tool_calls": json.dumps(tool_call_parts) if tool_call_parts else None,
    }


def _raw_messages_from_attribute(raw: Any, default_role: str) -> list[RawMessage]:
    parsed = _parse_attribute(raw)
    if parsed is _INVALID_JSON:
        return []
    return _raw_messages_from_value(parsed, default_role)


def _parse_attribute(raw: Any) -> Any:
    if not isinstance(raw, str):
        return raw
    if not _looks_like_json(raw):
        return raw
    return _parse_json_string(raw, fallback=_INVALID_JSON)


def _raw_messages_from_value(value: Any, default_role: str) -> list[RawMessage]:
    if isinstance(value, str):
        return [{"role": default_role, "content": value}] if value.strip() else []

    if isinstance(value, list):
        return _collect_raw_messages(value, default_role)

    if not isinstance(value, dict):
        return []

    if "messages" in value:
        return _unwrap_messages_field(value, default_role)

    if "prompt" in value:
        return _unwrap_system_prompt(value)

    single = _to_raw_message(value, default_role)
    return [single] if single else []


def _collect_raw_messages(items: list[Any], default_role: str) -> list[RawMessage]:
    out: list[RawMessage] = []
    for item in items:
        msg = _to_raw_message(item, default_role)
        if msg:
            out.append(msg)
    return out


def _unwrap_messages_field(value: dict[str, Any], default_role: str) -> list[RawMessage]:
    result: list[RawMessage] = []
    system = value.get("system")
    if system:
        result.append({"role": "system", "role_explicit": True, "content": system})

    inner = value.get("messages")
    if isinstance(inner, list):
        result.extend(_collect_raw_messages(inner, default_role))
        return result

    if isinstance(inner, str):
        parsed_inner = _parse_json_string(inner, fallback=_INVALID_JSON)
        if parsed_inner is _INVALID_JSON:
            if inner.strip():
                result.append({"role": default_role, "content": inner})
            return result
        result.extend(_raw_messages_from_value(parsed_inner, default_role))

    return result


def _unwrap_system_prompt(value: dict[str, Any]) -> list[RawMessage]:
    result: list[RawMessage] = []
    system = value.get("system")
    if system:
        result.append({"role": "system", "role_explicit": True, "content": system})
    prompt = value.get("prompt")
    if prompt:
        result.append({"role": "user", "role_explicit": True, "content": prompt})
    return result


def _to_raw_message(item: Any, default_role: str) -> RawMessage | None:
    if isinstance(item, str):
        return {"role": default_role, "content": item} if item.strip() else None

    if not isinstance(item, dict):
        return None

    raw_role = item.get("role")
    role = raw_role if isinstance(raw_role, str) and raw_role else None
    if isinstance(item.get("parts"), list):
        return {
            "role": role or default_role,
            "role_explicit": role is not None,
            "parts": item["parts"],
        }
    if "content" in item:
        return {
            "role": role or default_role,
            "role_explicit": role is not None,
            "content": item.get("content"),
        }
    if "completion" in item:
        return {
            "role": role or default_role,
            "role_explicit": role is not None,
            "content": item.get("completion"),
        }
    return None


def _resolve_message_content(msg: RawMessage, role: str) -> Any:
    if "parts" in msg:
        return _collapse_parts(msg["parts"])

    content = _try_parse_json_recursive(msg.get("content"))
    return content if role == "tool" else _render_text_content(content)


def _render_text_content(content: Any) -> Any:
    if isinstance(content, list):
        return _extract_text_from_content_parts(content)
    return content


def _try_parse_json_recursive(value: Any) -> Any:
    if not isinstance(value, str):
        return value

    parsed_value = _parse_json_string(value, fallback=_INVALID_JSON)
    if parsed_value is _INVALID_JSON:
        return value

    if parsed_value is None or isinstance(parsed_value, (bool, int, float)):
        return value
    if isinstance(parsed_value, list):
        return [_try_parse_json_recursive(item) for item in parsed_value]
    return parsed_value


def _collapse_parts(parts: list[Any]) -> Any:
    buckets = _bucket_parts(parts)

    if buckets["has_renderable_text_part"]:
        return "\n".join(buckets["text_parts"])
    if buckets["object_parts"]:
        return (
            buckets["object_parts"][0]
            if len(buckets["object_parts"]) == 1
            else buckets["object_parts"]
        )
    if buckets["tool_calls"]:
        return buckets["tool_calls"]
    if buckets["tool_responses"]:
        return "\n".join(str(response.get("result", "")) for response in buckets["tool_responses"])

    return None


def _bucket_parts(parts: list[Any]) -> PartBuckets:
    buckets: PartBuckets = {
        "has_renderable_text_part": False,
        "text_parts": [],
        "object_parts": [],
        "tool_calls": [],
        "tool_responses": [],
    }

    for part in parts:
        if not isinstance(part, dict):
            continue

        part_type = part.get("type")
        if part_type in FILE_CONTENT_PARTS:
            buckets["has_renderable_text_part"] = True
            buckets["text_parts"].append(_redacted_file_content(part))
            continue
        if part_type == "text":
            buckets["has_renderable_text_part"] = True
            text = _text_from_part(part, strip=True)
            if text:
                buckets["text_parts"].append(text)
            continue
        if not part_type:
            text = _text_from_part(part, strip=True)
            if text:
                buckets["text_parts"].append(text)
            continue
        if part_type == "object":
            buckets["object_parts"].append(part)
            continue
        if part_type == "tool_call":
            buckets["tool_calls"].append(part)
            continue
        if part_type == "tool_call_response":
            buckets["tool_responses"].append(part)

    return buckets


def _select_assistant_messages(raw_messages: list[RawMessage]) -> list[RawMessage]:
    has_role = any(msg.get("role_explicit") is True for msg in raw_messages)
    if has_role:
        return [msg for msg in raw_messages if msg.get("role") == "assistant"]
    return [raw_messages[-1]]


def _append_output_from_message(
    msg: RawMessage,
    *,
    text_parts: list[str],
    tool_call_parts: list[Any],
    object_parts: list[Any],
) -> None:
    if "parts" in msg:
        _append_output_from_parts(
            msg["parts"],
            text_parts=text_parts,
            tool_call_parts=tool_call_parts,
            object_parts=object_parts,
        )
        return

    content = _try_parse_json_recursive(msg.get("content"))
    if content is None:
        return
    if isinstance(content, str) and content:
        text_parts.append(content)
    elif isinstance(content, list):
        text = _extract_text_from_content_parts(content)
        if text:
            text_parts.append(text)
    elif isinstance(content, dict):
        object_parts.append(content)


def _append_output_from_parts(
    parts: list[Any],
    *,
    text_parts: list[str],
    tool_call_parts: list[Any],
    object_parts: list[Any],
) -> None:
    for part in parts:
        if not isinstance(part, dict):
            continue

        part_type = part.get("type")
        if part_type == "text":
            text = part.get("content") or part.get("text")
            if isinstance(text, str) and text:
                text_parts.append(text)
            continue
        if part_type == "tool_call":
            tool_call_parts.append(part)
            continue
        if part_type == "object":
            object_parts.append(part)
            continue
        if part_type in FILE_CONTENT_PARTS:
            text_parts.append(_redacted_file_content(part))


def _parse_json_string(value: str, *, fallback: Any) -> Any:
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return fallback


def _looks_like_json(raw: str) -> bool:
    stripped = raw.strip()
    if not stripped:
        return False
    return stripped[0] in ("[", "{", '"')


def _extract_text_from_content_parts(parts: list[Any]) -> str:
    return "\n".join(_bucket_parts(parts)["text_parts"])


def _text_from_part(part: dict[str, Any], *, strip: bool = False) -> str | None:
    text = part.get("text") or part.get("content")
    if not isinstance(text, str) or not text:
        return None
    return text.strip() if strip else text


def _redacted_file_content(part: dict[str, Any]) -> str:
    return f'\n\n[redacted content of type "{part.get("mime_type") or "unknown"}"]\n\n'
