import json  # noqa: S003
from typing import Any, TypedDict

FILTERED = "[Filtered]"
FILE_CONTENT_PARTS = ("blob", "uri", "file")


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


# Keep this parser mirrored with
# static/app/views/insights/pages/agents/utils/aiMessageNormalizer.ts.
# AI SDKs emit inconsistent shapes and their specs keep changing, so update both
# parsers together whenever adding or changing a supported format.
def normalize_to_messages(raw: Any, default_role: str) -> list[AIMessage] | None:
    raw_messages = _parse_and_detect(raw, default_role)

    normalized: list[AIMessage] = []
    for msg in raw_messages:
        role = msg.get("role") or default_role
        content = _resolve_message_content(msg, role)
        if content is None or content == "":
            continue
        normalized.append({"role": role, "content": content})

    return normalized or None


def extract_assistant_output(raw: Any, default_role: str) -> AIOutputResult:
    raw_messages = _parse_and_detect(raw, default_role)
    if not raw_messages:
        return {"response_text": None, "response_object": None, "tool_calls": None}

    selected = _select_assistant_messages(raw_messages)

    text_parts: list[str] = []
    tool_call_parts: list[Any] = []
    object_parts: list[Any] = []
    for msg in selected:
        _collect_output_extras(
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


def _parse_and_detect(raw: Any, default_role: str) -> list[RawMessage]:
    if isinstance(raw, str):
        if not _looks_like_json(raw):
            return [{"role": default_role, "content": raw}] if raw.strip() else []

        try:
            parsed = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return []
        return _detect_shape(parsed, default_role)

    return _detect_shape(raw, default_role)


def _detect_shape(value: Any, default_role: str) -> list[RawMessage]:
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
        try:
            result.extend(_detect_shape(json.loads(inner), default_role))
        except (json.JSONDecodeError, TypeError):
            if inner.strip():
                result.append({"role": default_role, "content": inner})

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

    role = item.get("role") if isinstance(item.get("role"), str) and item.get("role") else None
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

    try:
        parsed_value = json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return value

    if parsed_value is None or isinstance(parsed_value, (bool, int, float)):
        return value
    if isinstance(parsed_value, list):
        return [_try_parse_json_recursive(item) for item in parsed_value]
    return parsed_value


def _collapse_parts(parts: list[Any]) -> Any:
    has_text = any(isinstance(part, dict) and part.get("type") == "text" for part in parts)
    has_file = any(
        isinstance(part, dict) and part.get("type") in FILE_CONTENT_PARTS for part in parts
    )
    if has_text or has_file:
        return _extract_text_from_content_parts(parts)

    object_parts = [
        part for part in parts if isinstance(part, dict) and part.get("type") == "object"
    ]
    if object_parts:
        return object_parts[0] if len(object_parts) == 1 else object_parts

    tool_calls = [
        part for part in parts if isinstance(part, dict) and part.get("type") == "tool_call"
    ]
    if tool_calls:
        return tool_calls

    tool_responses = [
        part
        for part in parts
        if isinstance(part, dict) and part.get("type") == "tool_call_response"
    ]
    if tool_responses:
        return "\n".join(str(response.get("result", "")) for response in tool_responses)

    return None


def _select_assistant_messages(raw_messages: list[RawMessage]) -> list[RawMessage]:
    has_role = any(msg.get("role_explicit") is True for msg in raw_messages)
    if has_role:
        return [msg for msg in raw_messages if msg.get("role") == "assistant"]
    return [raw_messages[-1]]


def _collect_output_extras(
    msg: RawMessage,
    *,
    text_parts: list[str],
    tool_call_parts: list[Any],
    object_parts: list[Any],
) -> None:
    if "parts" in msg:
        for part in msg["parts"]:
            if not isinstance(part, dict):
                continue
            if part.get("type") == "text":
                text = part.get("content") or part.get("text")
                if isinstance(text, str) and text:
                    text_parts.append(text)
            elif part.get("type") == "tool_call":
                tool_call_parts.append(part)
            elif part.get("type") == "object":
                object_parts.append(part)
            elif part.get("type") in FILE_CONTENT_PARTS:
                text_parts.append(
                    f'\n\n[redacted content of type "{part.get("mime_type") or "unknown"}"]\n\n'
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


def _looks_like_json(raw: str) -> bool:
    stripped = raw.strip()
    if not stripped:
        return False
    return stripped[0] in ("[", "{", '"')


def _extract_text_from_content_parts(parts: list[Any]) -> str:
    texts: list[str] = []
    for part in parts:
        if not isinstance(part, dict):
            continue
        if part.get("type") in FILE_CONTENT_PARTS:
            texts.append(
                f'\n\n[redacted content of type "{part.get("mime_type") or "unknown"}"]\n\n'
            )
            continue
        if not part.get("type") or part.get("type") == "text":
            text = part.get("text") or part.get("content")
            if isinstance(text, str) and text:
                texts.append(text.strip())
    return "\n".join(texts)
