"""Section functions: each reads the flat model and emits a block via the formatter.

A section is ``(model, formatter, limits) -> str`` and returns "" to render nothing. Caps
(frame count, per-section chars) are applied here, so the model can carry full data and the
profile's limits decide what actually gets rendered. Content mirrors Seer's per-section output.
"""

from __future__ import annotations

from sentry.issues.formatting.formatter import Formatter
from sentry.issues.formatting.limits import Limits
from sentry.issues.formatting.models import EventObject, Frame, Stacktrace


def _truncate(text: str, max_chars: int | None) -> str:
    if max_chars is None or len(text) <= max_chars:
        return text
    return text[:max_chars].rstrip() + "\n... (truncated)"


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
