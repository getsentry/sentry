"""Section functions (each builds one block), the default section order (``EVENT_SECTIONS``),
and the public ``format_issue`` entry point. Sections decide what goes in a block and how much
of it; the formatter decides how it renders. A section with nothing to say returns ``None``.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from datetime import UTC
from typing import Any

from sentry.issues.formatting.adapter import event_response_to_model
from sentry.issues.formatting.formatter import (
    Code,
    Field,
    Format,
    Group,
    Section,
    SectionFn,
    Text,
    get_formatter,
    truncate,
)
from sentry.issues.formatting.limits import LIMITS_DEFAULT, Limits
from sentry.issues.formatting.models import EventObject, Frame, Stacktrace, contains_filtered

logger = logging.getLogger(__name__)


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
    return truncate(body, limits.max_stacktrace_chars)


def exceptions_section(model: EventObject, limits: Limits) -> Section | None:
    if not model.exceptions:
        return None

    groups: list[Group] = []
    for exc in model.exceptions:
        header = ": ".join(p for p in (exc.type, exc.value) if p) or "Error"
        items: list[Any] = [Text(header)]
        if exc.is_handled is not None:
            items.append(Field("Handled", "Yes" if exc.is_handled else "No"))
        if exc.stacktrace and exc.stacktrace.frames:
            items.append(Code(_render_stacktrace(exc.stacktrace, limits)))
        groups.append(Group(items=tuple(items)))

    return Section(
        title="Exception",
        groups=tuple(groups),
        max_group_chars=limits.max_exceptions_chars,
    )


def stacktrace_section(model: EventObject, limits: Limits) -> Section | None:
    # frames from a bare ``stacktrace`` entry; exception-owned stacktraces render above
    st = model.stacktrace
    if not (st and st.frames):
        return None
    return Section(
        title="Stacktrace",
        groups=(Group(items=(Code(_render_stacktrace(st, limits)),)),),
    )


def title_section(model: EventObject, limits: Limits) -> Section | None:
    # transaction and date belong on the title line rather than blocks of their own
    items: list[Any] = [Text(model.title)]
    if model.transaction_name:
        items.append(Field("Transaction", model.transaction_name))
    if model.culprit:
        items.append(Field("Culprit", model.culprit))
    if model.timestamp:
        items.append(
            Field("Date", model.timestamp.astimezone(UTC).strftime("%Y-%m-%d %H:%M:%S UTC"))
        )
    return Section(title="Title", groups=(Group(items=tuple(items)),))


def message_section(model: EventObject, limits: Limits) -> Section | None:
    # only render the message when it adds something beyond the title
    if not model.message or model.message in model.title:
        return None
    return Section(title="Message", groups=(Group(items=(Text(model.message),)),))


def detection_context_section(model: EventObject, limits: Limits) -> Section | None:
    # why a detector opened the issue; only detector-backed issue types carry it
    if not model.detection_context:
        return None
    return Section(
        title="Detection Context",
        groups=(Group(items=(Text(model.detection_context),)),),
    )


def troubleshooting_hint_section(model: EventObject, limits: Limits) -> Section | None:
    if not model.troubleshooting_hint:
        return None
    return Section(
        title="Troubleshooting Hint",
        groups=(Group(items=(Text(model.troubleshooting_hint),)),),
    )


def breadcrumbs_section(model: EventObject, limits: Limits) -> Section | None:
    # a zero cap has to bail here: the slice below is ``[-0:]`` at that point, which is ``[0:]``
    # and would render every breadcrumb instead of none
    if not model.breadcrumbs or not limits.max_breadcrumbs:
        return None

    lines: list[Any] = []
    for crumb in model.breadcrumbs[-limits.max_breadcrumbs :]:  # most recent N
        if contains_filtered(crumb.message) or contains_filtered(crumb.data):
            continue
        level = f"[{crumb.level}] " if crumb.level else ""
        category = f"{crumb.category}: " if crumb.category else ""
        line = f"{level}{category}{crumb.message or ''}".strip()
        if crumb.data:
            line += f" {crumb.data}"
        if line:
            lines.append(Text(truncate(line, limits.max_single_breadcrumb_chars)))

    if not lines:
        return None
    return Section(
        title="Breadcrumbs",
        groups=(Group(items=tuple(lines), max_chars=limits.max_breadcrumbs_chars),),
    )


def request_section(model: EventObject, limits: Limits) -> Section | None:
    req = model.request
    if not req or not (req.method or req.url or req.data):
        return None

    items: list[Any] = []
    if req.method or req.url:
        items.append(Text(f"{req.method or ''} {req.url or ''}".strip()))
    if req.data:
        items.append(Code(truncate(str(req.data), limits.max_request_chars)))
    return Section(title="Request", groups=(Group(items=tuple(items)),))


def csp_section(model: EventObject, limits: Limits) -> Section | None:
    csp = model.csp
    if not csp:
        return None
    fields = {
        "Blocked": csp.blocked_uri,
        "Directive": csp.effective_directive,
        "Document": csp.document_uri,
    }
    present = tuple(Field(k, v) for k, v in fields.items() if v)
    if not present:
        return None
    return Section(title="CSP", groups=(Group(items=present),))


def tags_section(model: EventObject, limits: Limits) -> Section | None:
    # ingest derives a `sentry:user` tag from the EventUser and the serializer exposes it as
    # plain `user` ("email:someone@example.com"), so leaving it here would put an identifier in
    # the default output that ``user_section`` is held back to keep out. It carries nothing
    # ``user_section`` doesn't render properly for the callers that do opt in.
    tags = [(key, value) for key, value in model.tags if key != "user"]
    if not tags:
        return None
    items = tuple(Field(key, value or "") for key, value in tags)
    return Section(title="Tags", groups=(Group(items=items),))


def user_section(model: EventObject, limits: Limits) -> Section | None:
    user = model.user
    if not user:
        return None
    fields = {
        "ID": user.id,
        "Email": user.email,
        "Username": user.username,
        "IP": user.ip_address,
    }
    present = tuple(Field(k, v) for k, v in fields.items() if v)
    if not present:
        return None
    return Section(title="User", groups=(Group(items=present),))


def threads_section(model: EventObject, limits: Limits) -> Section | None:
    groups: list[Group] = []
    for thread in model.threads:
        # only threads that carry a stacktrace are worth rendering
        st = thread.stacktrace
        if not (st and st.frames):
            continue
        # checked before appending, not after: testing at the bottom lets a zero cap through
        # with one thread already rendered
        if len(groups) >= limits.max_threads:  # bound total output by thread count
            break
        label = thread.name or (str(thread.id) if thread.id is not None else "Thread")
        items: list[Any] = [Text(label)]
        if thread.crashed:
            items.append(Field("Crashed", "Yes"))
        items.append(Code(_render_stacktrace(st, limits)))
        groups.append(Group(items=tuple(items)))

    if not groups:
        return None
    return Section(title="Threads", groups=tuple(groups))


def spans_section(model: EventObject, limits: Limits) -> Section | None:
    lines: list[Any] = []
    for span in model.spans:
        label = ": ".join(p for p in (span.op, span.description) if p)
        timing = f" ({span.exclusive_time}ms)" if span.exclusive_time is not None else ""
        line = f"{label}{timing}".strip()
        if line:
            lines.append(Text(line))

    if not lines:
        return None
    return Section(
        title="Span Evidence",
        groups=(Group(items=tuple(lines), max_chars=limits.max_spans_chars),),
    )


def metric_alert_section(model: EventObject, limits: Limits) -> Section | None:
    # the query a metric issue fired on; evidence_section only names the metric
    if not model.metric_alert:
        return None
    items = tuple(Field(label, value) for label, value in model.metric_alert)
    return Section(title="Metric Alert Details", groups=(Group(items=items),))


def evidence_section(model: EventObject, limits: Limits) -> Section | None:
    if not model.evidence:
        return None
    # evidenceDisplay is arbitrary-length pairs, so it needs the same cap the other open-ended
    # sections get. Cap each value first: the item cap always keeps the first piece, so one
    # oversized value would otherwise carry the section past the cap.
    items = tuple(
        Field(name, truncate(value, limits.max_evidence_chars)) for name, value in model.evidence
    )
    return Section(
        title="Evidence",
        groups=(Group(items=items, max_item_chars=limits.max_evidence_chars),),
    )


def contexts_section(model: EventObject, limits: Limits) -> Section | None:
    groups: list[Group] = []
    for name, data in model.contexts.items():
        # drop the redundant "type" key each context echoes (e.g. browser -> type: "browser")
        fields = [f"{key}: {value}" for key, value in data.items() if key != "type"]
        if fields:
            groups.append(Group(items=(Text(name), *(Text(f) for f in fields))))
    if not groups:
        return None
    return Section(
        title="Contexts",
        groups=tuple(groups),
        max_chars=limits.max_contexts_chars,
    )


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
    metric_alert_section,
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
    """Render a serialized event into text or JSON. The single path used by every consumer.

    Returns "" when the payload can't be adapted, matching how ``Formatter.render`` absorbs
    per-section failures, so a malformed event never takes down the caller.
    """
    formatter = get_formatter(format)
    try:
        model = event_response_to_model(data)
    except Exception:
        logger.exception("formatter.adapter_failed")
        # degrade to an empty render the requested format can still parse
        return formatter.join([])
    return formatter.render(model, sections, limits)
