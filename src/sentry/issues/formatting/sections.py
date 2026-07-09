"""Section functions (each renders one block), the default section order (``EVENT_SECTIONS``),
and the public ``format_issue`` entry point. Sections apply the size caps as they render;
content mirrors Seer's per-section output.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any, Literal

from sentry.issues.formatting.adapter import event_response_to_model
from sentry.issues.formatting.formatter import Formatter, MarkdownFormatter, SectionFn, XmlFormatter
from sentry.issues.formatting.limits import LIMITS_DEFAULT, Limits
from sentry.issues.formatting.models import EventObject, Frame, Stacktrace


def _truncate(text: str, max_chars: int | None) -> str:
    if max_chars is None or len(text) <= max_chars:
        return text
    return text[:max_chars].rstrip() + "\n... (truncated)"


def _contains_filtered(value: Any) -> bool:
    return "[Filtered]" in str(value)


def _render_frame(frame: Frame) -> str:
    function = frame.function or "Unknown function"
    if frame.filename:
        location = f"in {frame.filename}"
    elif frame.package:
        location = f"in package {frame.package}"
    else:
        location = "in unknown file"

    if frame.line_no is not None:
        col = f", column {frame.col_no}" if frame.col_no is not None else ""
        line = f" [Line {frame.line_no}{col}]"
    else:
        line = " [Line: Unknown]"

    app = "In app" if frame.in_app else "Not in app"
    header = f"{function} {location}{line} ({app})"

    lines = [header]
    for ctx_line_no, source in frame.context:
        suspect = "  <-- SUSPECT LINE" if ctx_line_no == frame.line_no else ""
        lines.append(f"{source or ''}{suspect}")
    if frame.vars:
        rendered = ", ".join(f"{k}={v!r}" for k, v in frame.vars.items())
        lines.append(f"vars: {rendered}")
    return "\n".join(lines)


def _render_stacktrace(stacktrace: Stacktrace, limits: Limits) -> str:
    # most-recent frame first, capped to max_frames (matches Seer)
    frames = list(reversed(stacktrace.frames[-limits.max_frames :]))
    body = "\n------\n".join(_render_frame(f) for f in frames)
    return _truncate(body, limits.max_stacktrace_chars)


def exceptions_section(model: EventObject, fmt: Formatter, limits: Limits) -> str:
    if not model.exceptions:
        return ""

    blocks: list[str] = []
    for exc in model.exceptions:
        header = ": ".join(p for p in (exc.type, exc.value) if p) or "Error"
        parts = [header]
        if exc.is_handled is not None:
            parts.append(fmt.field("Handled", "Yes" if exc.is_handled else "No"))
        if exc.stacktrace and exc.stacktrace.frames:
            parts.append(fmt.code_block(_render_stacktrace(exc.stacktrace, limits)))
        blocks.append("\n".join(parts))

    body = _truncate("\n\n".join(blocks), limits.max_exceptions_chars)
    return fmt.block("Exception", body)


def title_section(model: EventObject, fmt: Formatter, limits: Limits) -> str:
    body = model.title
    if model.culprit:
        body += "\n" + fmt.field("Culprit", model.culprit)
    return fmt.block("Title", body)


def message_section(model: EventObject, fmt: Formatter, limits: Limits) -> str:
    # only render the message when it adds something beyond the title (matches Seer)
    if not model.message or model.message in model.title:
        return ""
    return fmt.block("Message", model.message)


def breadcrumbs_section(model: EventObject, fmt: Formatter, limits: Limits) -> str:
    if not model.breadcrumbs:
        return ""

    lines: list[str] = []
    for crumb in model.breadcrumbs[-limits.max_breadcrumbs :]:  # most recent N
        if _contains_filtered(crumb.message) or _contains_filtered(crumb.data):
            continue
        level = f"[{crumb.level}] " if crumb.level else ""
        category = f"{crumb.category}: " if crumb.category else ""
        line = f"{level}{category}{crumb.message or ''}".strip()
        if crumb.data:
            line += f" {crumb.data}"
        lines.append(_truncate(line, limits.max_single_breadcrumb_chars))

    if not lines:
        return ""
    return fmt.block("Breadcrumbs", _truncate("\n".join(lines), limits.max_breadcrumbs_chars))


def request_section(model: EventObject, fmt: Formatter, limits: Limits) -> str:
    req = model.request
    if not req or not (req.method or req.url or req.data):
        return ""

    parts: list[str] = []
    if req.method or req.url:
        parts.append(f"{req.method or ''} {req.url or ''}".strip())
    if req.data:
        parts.append(fmt.code_block(_truncate(str(req.data), limits.max_request_chars)))
    return fmt.block("Request", "\n".join(parts))


def tags_section(model: EventObject, fmt: Formatter, limits: Limits) -> str:
    if not model.tags:
        return ""
    body = "\n".join(fmt.field(key, value or "") for key, value in model.tags)
    return fmt.block("Tags", body)


def user_section(model: EventObject, fmt: Formatter, limits: Limits) -> str:
    user = model.user
    if not user:
        return ""
    fields = {
        "ID": user.id,
        "Email": user.email,
        "Username": user.username,
        "IP": user.ip_address,
    }
    present = [fmt.field(k, v) for k, v in fields.items() if v]
    if not present:
        return ""
    return fmt.block("User", "\n".join(present))


def threads_section(model: EventObject, fmt: Formatter, limits: Limits) -> str:
    blocks: list[str] = []
    for thread in model.threads:
        # only threads that carry a stacktrace are worth rendering (matches Seer)
        st = thread.stacktrace
        if not (st and st.frames):
            continue
        label = thread.name or (str(thread.id) if thread.id is not None else "Thread")
        parts = [label]
        if thread.crashed:
            parts.append(fmt.field("Crashed", "Yes"))
        parts.append(fmt.code_block(_render_stacktrace(st, limits)))
        blocks.append("\n".join(parts))

    if not blocks:
        return ""
    return fmt.block("Threads", "\n\n".join(blocks))


def spans_section(model: EventObject, fmt: Formatter, limits: Limits) -> str:
    if not model.spans:
        return ""
    lines: list[str] = []
    for span in model.spans:
        label = ": ".join(p for p in (span.op, span.description) if p)
        timing = f" ({span.exclusive_time_ms}ms)" if span.exclusive_time_ms is not None else ""
        lines.append(f"{label}{timing}".strip())
    return fmt.block("Span Evidence", _truncate("\n".join(lines), limits.max_spans_chars))


Format = Literal["markdown", "xml"]

_FORMATTERS: dict[Format, type[Formatter]] = {
    "markdown": MarkdownFormatter,
    "xml": XmlFormatter,
}

# base event sections in render order
EVENT_SECTIONS: list[SectionFn] = [
    title_section,
    message_section,
    exceptions_section,
    threads_section,
    spans_section,
    breadcrumbs_section,
    request_section,
    tags_section,
    user_section,
]


def format_issue(
    data: Mapping[str, Any],
    *,
    format: Format = "markdown",
    sections: Sequence[SectionFn] = EVENT_SECTIONS,
    limits: Limits = LIMITS_DEFAULT,
) -> str:
    """Render a serialized event into text. The single path used by every consumer."""
    try:
        formatter_cls = _FORMATTERS[format]
    except KeyError:
        raise ValueError(f"unsupported format: {format!r}") from None

    model = event_response_to_model(data)
    return formatter_cls().render(model, sections, limits)
