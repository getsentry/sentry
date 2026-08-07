"""Section functions (each renders one block), the default section order (``EVENT_SECTIONS``),
and the public ``format_issue`` entry point. Sections apply the size caps as they render.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from datetime import UTC
from typing import Any

from sentry.issues.formatting.adapter import event_response_to_model
from sentry.issues.formatting.formatter import Format, Formatter, SectionFn, get_formatter
from sentry.issues.formatting.limits import LIMITS_DEFAULT, Limits
from sentry.issues.formatting.models import EventObject, Frame, Stacktrace, contains_filtered

logger = logging.getLogger(__name__)


_TRUNCATED = "... (truncated)"


def _truncate(text: str, max_chars: int | None) -> str:
    """Cap a run of plain text. Only for content the formatter has not marked up yet -- use
    ``_truncate_items`` once a body is a join of rendered pieces.
    """
    if max_chars is None or len(text) <= max_chars:
        return text
    return text[:max_chars].rstrip() + f"\n{_TRUNCATED}"


def _truncate_items(items: Sequence[str], sep: str, max_chars: int | None) -> str:
    """Join rendered pieces, dropping whole ones once the cap is hit.

    Slicing a joined body mid-way would cut through a tag a section already emitted and leave
    the output unparseable, so entire items go instead.
    """
    if max_chars is None:
        return sep.join(items)

    kept: list[str] = []
    total = 0
    for item in items:
        cost = len(item) + (len(sep) if kept else 0)
        # always keep the first piece: a section rendering nothing but "(truncated)" has lost
        # its content entirely, which is worse than overshooting the cap once
        if kept and total + cost > max_chars:
            kept.append(_TRUNCATED)
            break
        kept.append(item)
        total += cost
    return sep.join(kept)


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


def _select_frames(frames: Sequence[Frame], max_frames: int) -> list[Frame]:
    """Cap the frame count, trimming system frames first and keeping the head and tail of each
    group, so app frames survive a deep stack.
    """
    if len(frames) <= max_frames:
        return list(frames)

    # selection happens on positions, not frames, so the survivors can be put back in stack
    # order at the end without needing frames to be distinguishable from one another
    app = [i for i, frame in enumerate(frames) if frame.in_app]
    system = [i for i, frame in enumerate(frames) if not frame.in_app]
    system_allowance = max(max_frames - len(app), 0)

    def head_and_tail(group: list[int], allowance: int) -> list[int]:
        if len(group) <= allowance:
            return group
        # split the allowance exactly, giving the odd slot to the head; halving it instead
        # silently drops a frame that fits whenever the allowance is odd
        head = (allowance + 1) // 2
        tail = allowance - head
        return group[:head] + (group[-tail:] if tail else [])

    kept = head_and_tail(system, system_allowance) + head_and_tail(
        app, max_frames - system_allowance
    )
    # app and system frames interleave in the original stack, so concatenating the two groups
    # leaves them out of order -- sorting the positions restores it
    return [frames[i] for i in sorted(kept)]


def _render_stacktrace(stacktrace: Stacktrace, limits: Limits) -> str:
    # most-recent frame first, capped to max_frames
    frames = reversed(_select_frames(stacktrace.frames, limits.max_frames))
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

    body = _truncate_items(blocks, "\n\n", limits.max_exceptions_chars)
    return fmt.block("Exception", body)


def stacktrace_section(model: EventObject, fmt: Formatter, limits: Limits) -> str:
    # frames from a bare ``stacktrace`` entry; exception-owned stacktraces render above
    st = model.stacktrace
    if not (st and st.frames):
        return ""
    return fmt.block("Stacktrace", fmt.code_block(_render_stacktrace(st, limits)))


def title_section(model: EventObject, fmt: Formatter, limits: Limits) -> str:
    # transaction and date belong on the title line rather than blocks of their own
    lines = [model.title]
    if model.transaction_name:
        lines.append(fmt.field("Transaction", model.transaction_name))
    if model.culprit:
        lines.append(fmt.field("Culprit", model.culprit))
    if model.timestamp:
        lines.append(
            fmt.field("Date", model.timestamp.astimezone(UTC).strftime("%Y-%m-%d %H:%M:%S UTC"))
        )
    return fmt.block("Title", "\n".join(lines))


def message_section(model: EventObject, fmt: Formatter, limits: Limits) -> str:
    # only render the message when it adds something beyond the title
    if not model.message or model.message in model.title:
        return ""
    return fmt.block("Message", model.message)


def detection_context_section(model: EventObject, fmt: Formatter, limits: Limits) -> str:
    # why a detector opened the issue; only detector-backed issue types carry it
    if not model.detection_context:
        return ""
    return fmt.block("Detection Context", model.detection_context)


def troubleshooting_hint_section(model: EventObject, fmt: Formatter, limits: Limits) -> str:
    if not model.troubleshooting_hint:
        return ""
    return fmt.block("Troubleshooting Hint", model.troubleshooting_hint)


def breadcrumbs_section(model: EventObject, fmt: Formatter, limits: Limits) -> str:
    # a zero cap has to bail here: the slice below is ``[-0:]`` at that point, which is ``[0:]``
    # and would render every breadcrumb instead of none
    if not model.breadcrumbs or not limits.max_breadcrumbs:
        return ""

    lines: list[str] = []
    for crumb in model.breadcrumbs[-limits.max_breadcrumbs :]:  # most recent N
        if contains_filtered(crumb.message) or contains_filtered(crumb.data):
            continue
        level = f"[{crumb.level}] " if crumb.level else ""
        category = f"{crumb.category}: " if crumb.category else ""
        line = f"{level}{category}{crumb.message or ''}".strip()
        if crumb.data:
            line += f" {crumb.data}"
        if line:
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


def csp_section(model: EventObject, fmt: Formatter, limits: Limits) -> str:
    csp = model.csp
    if not csp:
        return ""
    fields = {
        "Blocked": csp.blocked_uri,
        "Directive": csp.effective_directive,
        "Document": csp.document_uri,
    }
    present = [fmt.field(k, v) for k, v in fields.items() if v]
    if not present:
        return ""
    return fmt.block("CSP", "\n".join(present))


def tags_section(model: EventObject, fmt: Formatter, limits: Limits) -> str:
    # ingest derives a `sentry:user` tag from the EventUser and the serializer exposes it as
    # plain `user` ("email:someone@example.com"), so leaving it here would put an identifier in
    # the default output that ``user_section`` is held back to keep out. It carries nothing
    # ``user_section`` doesn't render properly for the callers that do opt in.
    tags = [(key, value) for key, value in model.tags if key != "user"]
    if not tags:
        return ""
    body = "\n".join(fmt.field(key, value or "") for key, value in tags)
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
        # only threads that carry a stacktrace are worth rendering
        st = thread.stacktrace
        if not (st and st.frames):
            continue
        # checked before appending, not after: testing at the bottom lets a zero cap through
        # with one thread already rendered
        if len(blocks) >= limits.max_threads:  # bound total output by thread count
            break
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
    lines: list[str] = []
    for span in model.spans:
        label = ": ".join(p for p in (span.op, span.description) if p)
        timing = f" ({span.exclusive_time}ms)" if span.exclusive_time is not None else ""
        line = f"{label}{timing}".strip()
        if line:
            lines.append(line)

    if not lines:
        return ""
    return fmt.block("Span Evidence", _truncate("\n".join(lines), limits.max_spans_chars))


def evidence_section(model: EventObject, fmt: Formatter, limits: Limits) -> str:
    if not model.evidence:
        return ""
    # occurrence.evidenceDisplay is an arbitrary-length list of arbitrary-length pairs, so it
    # needs the same cap the other open-ended sections get.
    # Cap each value before marking it up -- _truncate_items always keeps the first piece, so a
    # single oversized value would otherwise carry the whole section past the cap.
    rendered = [
        fmt.field(name, _truncate(value, limits.max_evidence_chars))
        for name, value in model.evidence
    ]
    return fmt.block("Evidence", _truncate_items(rendered, "\n", limits.max_evidence_chars))


def contexts_section(model: EventObject, fmt: Formatter, limits: Limits) -> str:
    groups: list[str] = []
    for name, data in model.contexts.items():
        # drop the redundant "type" key each context echoes (e.g. browser -> type: "browser")
        fields = [f"{key}: {value}" for key, value in data.items() if key != "type"]
        if fields:
            groups.append("\n".join([name, *fields]))
    if not groups:
        return ""
    return fmt.block("Contexts", _truncate("\n\n".join(groups), limits.max_contexts_chars))


# every section in render order, including the user identifiers that ``EVENT_SECTIONS`` holds
# back. Pass this only from a surface that already exposes those fields to its caller.
EVENT_SECTIONS_WITH_USER: list[SectionFn] = [
    title_section,
    message_section,
    detection_context_section,
    troubleshooting_hint_section,
    exceptions_section,
    stacktrace_section,
    csp_section,
    threads_section,
    spans_section,
    evidence_section,
    breadcrumbs_section,
    request_section,
    tags_section,
    user_section,
    contexts_section,
]

# sections that render a user identifier: ``user_section``'s email/IP/username/ID, and the device
# and session ids that ride along in contexts (device_unique_identifier, replay.replay_id, and
# whatever a custom context defines -- there is no safe key list for an open-ended mapping).
_USER_IDENTIFYING_SECTIONS = frozenset({user_section, contexts_section})

# the default. Rendered output is bound for an LLM, so user identifiers are opt-in -- a caller
# that doesn't think about it can't leak them into a prompt.
EVENT_SECTIONS: list[SectionFn] = [
    s for s in EVENT_SECTIONS_WITH_USER if s not in _USER_IDENTIFYING_SECTIONS
]


def format_issue(
    data: Mapping[str, Any],
    *,
    format: Format = "markdown",
    sections: Sequence[SectionFn] = EVENT_SECTIONS,
    limits: Limits = LIMITS_DEFAULT,
) -> str:
    """Render a serialized event into text. The single path used by every consumer.

    Returns "" when the payload can't be adapted, matching how ``Formatter.render`` absorbs
    per-section failures, so a malformed event never takes down the caller.
    """
    formatter = get_formatter(format)
    try:
        model = event_response_to_model(data)
    except Exception:
        logger.exception("formatter.adapter_failed")
        return ""
    return formatter.render(model, sections, limits)
