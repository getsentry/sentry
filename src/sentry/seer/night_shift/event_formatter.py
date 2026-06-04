"""
Event formatter for the Night Shift agentic triage tool.

Ported from sentry-mcp's `formatEventOutput`
(packages/mcp-core/src/internal/formatting.ts).

Scope: error-event path only — exceptions, threads, message, request, CSP,
tags, contexts, user. The transaction/performance-issue path (N+1 query
evidence, span-tree rendering, slow DB query evidence) and the generic-event
path (performance regression occurrences) are intentionally NOT ported —
they don't apply to error issues, which is the only shape the triage agent
investigates. If a transaction or generic event ever reaches this formatter,
the type-specific sections are silently skipped and the rest of the output
(tags, user, contexts) is still produced.
"""

from __future__ import annotations

import json  # noqa: S003 - need stdlib json for indent + default kwargs
import re
from collections.abc import Sequence
from typing import Any

_LANGUAGE_EXTENSIONS: dict[str, str] = {
    ".java": "java",
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "javascript",
    ".tsx": "javascript",
    ".rb": "ruby",
    ".php": "php",
}

_LANGUAGE_MODULE_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"^(java\.|com\.|org\.)"), "java"),
]


def format_event_output(event: dict[str, Any]) -> str:
    """Render a Sentry event as markdown optimized for LLM consumption."""
    output = ""
    user = event.get("user")
    entries = event.get("entries")

    if not isinstance(entries, list):
        output += _format_event_user(user)
        output += _format_tags(event.get("tags"))
        output += _format_context(event.get("context"))
        output += _format_contexts(event.get("contexts"))
        return output

    message_entry = _find_entry(entries, "message")
    exception_entry = _find_entry(entries, "exception")
    threads_entry = _find_entry(entries, "threads")
    request_entry = _find_entry(entries, "request")
    csp_entry = _find_entry(entries, "csp")

    if message_entry:
        output += _format_message_interface_output(message_entry.get("data") or {})

    if exception_entry:
        output += _format_exception_interface_output(event, exception_entry.get("data") or {})
    elif threads_entry:
        output += _format_threads_interface_output(event, threads_entry.get("data") or {})

    if request_entry:
        output += _format_request_interface_output(request_entry.get("data") or {})

    if csp_entry:
        output += _format_csp_interface_output(csp_entry.get("data"))

    # Transaction (type == "transaction") and generic (type == "generic")
    # event handling is intentionally omitted — see module docstring.

    output += _format_event_user(user)
    output += _format_tags(event.get("tags"))
    output += _format_context(event.get("context"))
    output += _format_contexts(event.get("contexts"))
    return output


def _find_entry(entries: list[dict[str, Any]], entry_type: str) -> dict[str, Any] | None:
    for entry in entries:
        if isinstance(entry, dict) and entry.get("type") == entry_type:
            return entry
    return None


def _format_message_interface_output(data: dict[str, Any]) -> str:
    message = data.get("formatted") or data.get("message") or ""
    if not message:
        return ""
    return f"### Error\n\n```\n{message}\n```\n\n"


def _format_exception_interface_output(event: dict[str, Any], data: dict[str, Any]) -> str:
    values = data.get("values")
    if values:
        exceptions = list(values)
    elif isinstance(data.get("value"), dict):
        exceptions = [data["value"]]
    else:
        return ""

    if not exceptions:
        return ""

    is_chained = len(exceptions) > 1
    parts: list[str] = []

    # Render outermost first: exceptions are innermost-first, so we reverse.
    for index, exception in enumerate(reversed(exceptions)):
        if not exception:
            continue

        if is_chained and index > 0:
            parts.append("")
            parts.append(_get_exception_chain_message(event.get("platform"), index))
            parts.append("")

        exc_type = exception.get("type") or ""
        exc_value = exception.get("value") or ""
        title = f"{exc_type}{': ' + exc_value if exc_value else ''}"

        parts.append("### Error" if index == 0 else f"### {title}")
        parts.append("")

        if index == 0:
            parts.append("```")
            parts.append(title)
            parts.append("```")
            parts.append("")

        stacktrace = exception.get("stacktrace") or {}
        frames = stacktrace.get("frames") if isinstance(stacktrace, dict) else None
        if not frames:
            parts.append("**Stacktrace:**")
            parts.append("```")
            parts.append("No stacktrace available")
            parts.append("```")
            continue

        if index == 0:
            first_in_app = _find_first_in_app_frame(frames)
            if first_in_app and (first_in_app.get("context") or first_in_app.get("vars")):
                parts.append(_render_enhanced_frame(first_in_app, event))
                parts.append("")
                parts.append("**Full Stacktrace:**")
                parts.append("────────────────")
            else:
                parts.append("**Stacktrace:**")
        else:
            parts.append("**Stacktrace:**")

        parts.append("```")
        parts.append(
            "\n".join(
                _format_frame_header(frame, None, event.get("platform"))
                + _render_inline_context(frame)
                for frame in frames
            )
        )
        parts.append("```")

    parts.append("")
    parts.append("")
    return "\n".join(parts)


def _format_threads_interface_output(event: dict[str, Any], data: dict[str, Any]) -> str:
    values = data.get("values")
    if not values:
        return ""

    crashed_thread = next(
        (t for t in values if isinstance(t, dict) and t.get("crashed")),
        None,
    )
    if not crashed_thread:
        return ""

    stacktrace = crashed_thread.get("stacktrace") or {}
    frames = stacktrace.get("frames") if isinstance(stacktrace, dict) else None
    if not frames:
        return ""

    parts: list[str] = []

    thread_name = crashed_thread.get("name")
    if thread_name:
        parts.append(f"**Thread** ({thread_name})")
        parts.append("")

    first_in_app = _find_first_in_app_frame(frames)
    if first_in_app and (first_in_app.get("context") or first_in_app.get("vars")):
        parts.append(_render_enhanced_frame(first_in_app, event))
        parts.append("")
        parts.append("**Full Stacktrace:**")
        parts.append("────────────────")
    else:
        parts.append("**Stacktrace:**")

    parts.append("```")
    parts.append(
        "\n".join(
            _format_frame_header(frame, None, event.get("platform")) + _render_inline_context(frame)
            for frame in frames
        )
    )
    parts.append("```")
    parts.append("")

    return "\n".join(parts)


def _format_request_interface_output(data: dict[str, Any]) -> str:
    method = data.get("method")
    url = data.get("url")
    if not method or not url:
        return ""
    return f"### HTTP Request\n\n**Method:** {method}\n**URL:** {url}\n\n"


def _format_csp_interface_output(data: Any) -> str:
    if not isinstance(data, dict) or not data:
        return ""

    parts: list[str] = ["### CSP Violation", ""]

    if data.get("blocked_uri"):
        parts.append(f"**Blocked URI**: {data['blocked_uri']}")
    if data.get("violated_directive"):
        parts.append(f"**Violated Directive**: {data['violated_directive']}")
    if data.get("effective_directive"):
        parts.append(f"**Effective Directive**: {data['effective_directive']}")
    if data.get("document_uri"):
        parts.append(f"**Document URI**: {data['document_uri']}")
    if data.get("source_file"):
        parts.append(f"**Source File**: {data['source_file']}")
        if data.get("line_number"):
            parts.append(f"**Line Number**: {data['line_number']}")
    if data.get("disposition"):
        parts.append(f"**Disposition**: {data['disposition']}")
    if data.get("original_policy"):
        parts.append("")
        parts.append("**Original Policy:**")
        parts.append("```")
        parts.append(str(data["original_policy"]))
        parts.append("```")

    parts.append("")
    parts.append("")
    return "\n".join(parts)


def _format_event_user(user: Any) -> str:
    if not isinstance(user, dict) or not user:
        return ""

    candidates: list[tuple[str, Any]] = [
        ("id", user.get("id")),
        ("email", user.get("email")),
        ("username", user.get("username")),
        ("ip", user.get("ip") or user.get("ip_address")),
        ("display_name", user.get("display_name") or user.get("name")),
    ]
    user_fields = [(k, v) for k, v in candidates if isinstance(v, str) and v]
    user_summary = ", ".join(f"{k}:{v}" for k, v in user_fields)
    geo_summary = _format_user_geo_summary(user.get("geo"))

    if not user_summary and not geo_summary:
        return ""

    output = "### User\n\n"
    if user_summary:
        output += f"**user**: {user_summary}\n"
    if geo_summary:
        output += f"**user.geo**: {geo_summary}\n"
    return output + "\n"


def _format_user_geo_summary(value: Any) -> str | None:
    if not isinstance(value, dict):
        return None
    candidates: list[Any] = [
        value.get("country_code"),
        value.get("city"),
        value.get("region"),
        value.get("country_name"),
    ]
    parts = [p for p in candidates if isinstance(p, str) and p]
    if not parts:
        return None
    deduped: dict[str, None] = {}
    for p in parts:
        deduped.setdefault(p, None)
    return ", ".join(deduped)


def _format_tags(tags: Any) -> str:
    if not isinstance(tags, list) or not tags:
        return ""
    lines = [
        f"**{t['key']}**: {t['value']}"
        for t in tags
        if isinstance(t, dict) and "key" in t and "value" in t
    ]
    if not lines:
        return ""
    return "### Tags\n\n" + "\n".join(lines) + "\n\n"


def _format_context(context: Any) -> str:
    if not isinstance(context, dict) or not context:
        return ""
    lines = [f"**{k}**: {json.dumps(v, indent=2, default=str)}" for k, v in context.items()]
    return (
        "### Extra Data\n\nAdditional data attached to this event.\n\n" + "\n".join(lines) + "\n\n"
    )


def _format_contexts(contexts: Any) -> str:
    if not isinstance(contexts, dict) or not contexts:
        return ""
    blocks: list[str] = []
    for name, data in contexts.items():
        if not isinstance(data, dict):
            continue
        inner = [
            f"{k}: {json.dumps(v, indent=2, default=str)}" for k, v in data.items() if k != "type"
        ]
        blocks.append(f"**{name}**\n" + "\n".join(inner))
    if not blocks:
        return ""
    return (
        "### Additional Context\n\n"
        "These are additional context provided by the user when they're "
        "instrumenting their application.\n\n" + "\n\n".join(blocks) + "\n\n"
    )


def _format_frame_header(
    frame: dict[str, Any], frame_index: int | None, platform: str | None
) -> str:
    language = _detect_language(frame, platform)

    filename = frame.get("filename") or ""
    abs_path = frame.get("absPath") or ""
    module = frame.get("module") or ""
    function = frame.get("function") or ""
    line_no = frame.get("lineNo")
    col_no = frame.get("colNo")

    if language == "java":
        class_name = module or "UnknownClass"
        method = function or "<unknown>"
        source = filename or "Unknown Source"
        loc = f":{line_no}" if line_no else ""
        return f"at {class_name}.{method}({source}{loc})"

    if language == "python":
        file = filename or abs_path or module or "<unknown>"
        func = function or "<module>"
        line = f", line {line_no}" if line_no else ""
        return f'  File "{file}"{line}, in {func}'

    if language == "javascript":
        pieces = [str(p) for p in (filename, line_no, col_no) if p]
        joined = ":".join(pieces)
        suffix = f" ({function})" if function else ""
        return f"{joined}{suffix}"

    if language == "ruby":
        file = filename or module or "<unknown>"
        func = f" `{function}`" if function else ""
        line = f":{line_no}:in" if line_no else ""
        return f"    from {file}{line}{func}"

    if language == "php":
        file = filename or "<unknown>"
        line = f"({line_no})" if line_no else ""
        func = function or "<unknown>"
        prefix = f"#{frame_index} " if frame_index is not None else ""
        return f"{prefix}{file}{line}: {func}()"

    func = function or "<unknown>"
    location = filename or module or "<unknown>"
    line = f":{line_no}" if line_no else ""
    col = f":{col_no}" if col_no is not None else ""
    return f"    at {func} ({location}{line}{col})"


def _detect_language(frame: dict[str, Any], platform: str | None) -> str:
    filename = frame.get("filename")
    if isinstance(filename, str):
        match = re.search(r"\.[^.]+$", filename.lower())
        if match:
            ext = match.group(0)
            if ext in _LANGUAGE_EXTENSIONS:
                return _LANGUAGE_EXTENSIONS[ext]
    module = frame.get("module")
    if isinstance(module, str):
        for pattern, language in _LANGUAGE_MODULE_PATTERNS:
            if pattern.match(module):
                return language
    return platform or "unknown"


def _render_inline_context(frame: dict[str, Any]) -> str:
    context = frame.get("context")
    line_no = frame.get("lineNo")
    if not context or not line_no:
        return ""
    for entry in context:
        if isinstance(entry, (list, tuple)) and len(entry) >= 2 and entry[0] == line_no:
            return f"\n{entry[1]}"
    return ""


def _render_enhanced_frame(frame: dict[str, Any], event: dict[str, Any]) -> str:
    parts: list[str] = [
        "**Most Relevant Frame:**",
        "─────────────────────",
        _format_frame_header(frame, None, event.get("platform")),
    ]

    if frame.get("context"):
        ctx = _render_context_lines(frame)
        if ctx:
            parts.append("")
            parts.append(ctx)

    vars_obj = frame.get("vars")
    if isinstance(vars_obj, dict) and vars_obj:
        parts.append("")
        parts.append(_render_variables_table(vars_obj))

    return "\n".join(parts)


def _render_context_lines(frame: dict[str, Any], context_size: int = 3) -> str:
    context = frame.get("context") or []
    error_line = frame.get("lineNo")
    if not context or not error_line:
        return ""

    pairs: list[tuple[int, str]] = []
    for entry in context:
        if isinstance(entry, (list, tuple)) and len(entry) >= 2:
            ln, code = entry[0], entry[1]
            if isinstance(ln, int):
                pairs.append((ln, str(code)))
    if not pairs:
        return ""

    max_width = max(len(str(ln)) for ln, _ in pairs)
    lines: list[str] = []
    for ln, code in pairs:
        if abs(ln - error_line) <= context_size:
            ln_str = str(ln).rjust(max_width)
            if ln == error_line:
                lines.append(f"  → {ln_str} │ {code}")
            else:
                lines.append(f"    {ln_str} │ {code}")

    return "\n".join(lines)


def _format_variable_value(value: Any, max_length: int = 80) -> str:
    try:
        if isinstance(value, str):
            # Overhead for quotes + ellipsis: `"..."` = 5 chars around the content.
            if len(value) + 2 > max_length:
                return f'"{value[: max_length - 5]}..."'
            return f'"{value}"'
        if value is None:
            return "null"
        # Check bool before int — bool is a subclass of int in Python.
        if isinstance(value, bool):
            return "true" if value else "false"
        if isinstance(value, (int, float)):
            return str(value)
        if isinstance(value, (list, tuple, dict)):
            stringified = json.dumps(value, default=str)
            if len(stringified) > max_length:
                truncate_at = max_length - 6
                truncated = stringified[:truncate_at]
                last_comma = truncated.rfind(",")
                if last_comma > 0:
                    truncated = truncated[:last_comma]
                if isinstance(value, (list, tuple)):
                    return f"{truncated}, ...]"
                return f"{truncated}, ...}}"
            return stringified
        return str(value)
    except Exception:
        return f"<{type(value).__name__}>"


def _render_variables_table(vars_obj: dict[str, Any]) -> str:
    entries = list(vars_obj.items())
    if not entries:
        return ""
    lines = ["Local Variables:"]
    last_index = len(entries) - 1
    for idx, (key, value) in enumerate(entries):
        prefix = "└─" if idx == last_index else "├─"
        lines.append(f"{prefix} {key}: {_format_variable_value(value)}")
    return "\n".join(lines)


def _find_first_in_app_frame(frames: Sequence[dict[str, Any]]) -> dict[str, Any] | None:
    for frame in reversed(list(frames)):
        if frame.get("inApp") is True:
            return frame
    return None


def _get_exception_chain_message(platform: str | None, index: int) -> str:
    # Exceptions are rendered outermost-first, so the chain message at index > 0
    # introduces an *inner* (causal) exception — "Caused by" reads naturally.
    default_msg = "**Caused by:**"
    if not platform:
        return default_msg
    p = platform.lower()
    if p == "python":
        return default_msg
    if p == "java":
        return default_msg
    if p in ("csharp", "dotnet"):
        return "**---> Inner Exception:**"
    if p == "ruby":
        return default_msg
    if p == "go":
        return "**Wrapped error:**"
    if p == "rust":
        # `index` enumerates reversed(exceptions) starting at 0, but the first
        # cause arrives here with index=1 (index=0 is the outermost, guarded out
        # at the call site). Rust's anyhow numbers causes from 0, so subtract 1.
        return f"**Caused by ({index - 1}):**"
    return default_msg
