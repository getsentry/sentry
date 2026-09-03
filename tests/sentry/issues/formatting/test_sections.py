import dataclasses
from datetime import datetime, timezone
from typing import Any
from xml.etree import ElementTree

import pytest

from sentry.issues.formatting.formatter import (
    Formatter,
    MarkdownFormatter,
    SectionFn,
    XmlFormatter,
)
from sentry.issues.formatting.limits import LIMITS_DEFAULT, Limits
from sentry.issues.formatting.models import (
    Breadcrumb,
    CspDetails,
    EventObject,
    EvidenceSpan,
    ExceptionDetails,
    Frame,
    RequestDetails,
    Stacktrace,
    ThreadDetails,
    UserDetails,
)
from sentry.issues.formatting.sections import (
    EVENT_SECTIONS,
    EVENT_SECTIONS_WITH_USER,
    breadcrumbs_section,
    contexts_section,
    csp_section,
    detection_context_section,
    evidence_section,
    exceptions_section,
    format_issue,
    message_section,
    request_section,
    spans_section,
    stacktrace_section,
    tags_section,
    threads_section,
    title_section,
    troubleshooting_hint_section,
    user_section,
)

MD = MarkdownFormatter()


def _render(section_fn: SectionFn, model: EventObject, fmt: Formatter, limits: Limits) -> str:
    """Build a section and render it, as ``Formatter.render`` does per section. A section with
    nothing to say is ``None``, which renders as "".
    """
    built = section_fn(model, limits)
    return fmt.render_section(built) if built is not None else ""


def _event_with_exception(**exc_kwargs: Any) -> EventObject:
    return EventObject(title="t", exceptions=[ExceptionDetails(**exc_kwargs)])


def test_no_exceptions_renders_nothing() -> None:
    out = _render(exceptions_section, EventObject(title="t"), MarkdownFormatter(), LIMITS_DEFAULT)
    assert out == ""


def test_basic_exception_with_handled_and_frame() -> None:
    event = _event_with_exception(
        type="ValueError",
        value="boom",
        is_handled=False,
        stacktrace=Stacktrace(
            frames=[
                Frame(
                    function="do_thing",
                    filename="app.py",
                    line_no=42,
                    in_app=True,
                    context=[(41, "x = 1"), (42, "raise ValueError('boom')")],
                )
            ]
        ),
    )
    out = _render(exceptions_section, event, MarkdownFormatter(), LIMITS_DEFAULT)
    assert out.startswith("## Exception\n")
    assert "ValueError: boom" in out
    assert "**Handled:** No" in out
    assert "do_thing in app.py [Line 42] (In app)" in out
    assert "raise ValueError('boom')  <-- SUSPECT LINE" in out
    assert "x = 1\n" in out  # non-suspect context line, no marker


def test_handled_omitted_when_none() -> None:
    event = _event_with_exception(type="ValueError", value="boom")  # is_handled defaults None
    out = _render(exceptions_section, event, MarkdownFormatter(), LIMITS_DEFAULT)
    assert "Handled" not in out


def test_frames_capped_and_most_recent_first() -> None:
    frames = [Frame(function=f"f{i}", filename="a.py", line_no=i) for i in range(20)]
    event = _event_with_exception(type="E", stacktrace=Stacktrace(frames=frames))
    out = _render(exceptions_section, event, MarkdownFormatter(), LIMITS_DEFAULT)
    # default cap is 16 frames; with no app frames, the head and tail of the system frames
    # are kept (f0..f7 + f12..f19), most-recent first
    assert out.count(" in a.py ") == 16
    assert "f19 in a.py" in out
    assert "f0 in a.py" in out
    assert "f8 in a.py" not in out  # dropped from the middle
    assert out.index("f19") < out.index("f0")  # reversed order


@pytest.mark.parametrize("app_frame_count", [4, 9])  # even and odd allowances
def test_frame_cap_keeps_app_frames(app_frame_count: int) -> None:
    # app frames must survive a deep stack: a blind tail slice would drop every one of these,
    # and halving an odd allowance would drop the middle one
    frames = [
        Frame(function=f"app{i}", filename="a.py", in_app=True) for i in range(app_frame_count)
    ]
    frames += [Frame(function=f"lib{i}", filename="v.py") for i in range(50)]
    event = _event_with_exception(type="E", stacktrace=Stacktrace(frames=frames))
    out = _render(exceptions_section, event, MarkdownFormatter(), LIMITS_DEFAULT)
    for i in range(app_frame_count):
        assert f"app{i} in a.py" in out
    assert out.count(" [Line: Unknown] ") == 16  # cap is filled exactly, never under


def test_stacktrace_char_truncation() -> None:
    frames = [Frame(function="f", filename="a.py", line_no=1)]
    event = _event_with_exception(type="E", stacktrace=Stacktrace(frames=frames))
    tight = dataclasses.replace(LIMITS_DEFAULT, max_stacktrace_chars=10)
    out = _render(exceptions_section, event, MarkdownFormatter(), tight)
    assert "(truncated)" in out


def test_xml_output() -> None:
    event = _event_with_exception(type="ValueError", value="boom")
    out = _render(exceptions_section, event, XmlFormatter(), LIMITS_DEFAULT)
    assert out.startswith("<exception>\n")
    assert out.endswith("\n</exception>")
    assert "ValueError: boom" in out


def test_title_with_culprit() -> None:
    event = EventObject(title="ValueError: boom", culprit="app.views.checkout")
    out = _render(title_section, event, MD, LIMITS_DEFAULT)
    assert "ValueError: boom" in out
    assert "**Culprit:** app.views.checkout" in out


def test_title_with_transaction_and_date() -> None:
    event = EventObject(
        title="ValueError: boom",
        transaction_name="/api/checkout",
        timestamp=datetime(2026, 7, 29, 10, 11, 12, tzinfo=timezone.utc),
    )
    out = _render(title_section, event, MD, LIMITS_DEFAULT)
    assert "**Transaction:** /api/checkout" in out
    assert "**Date:** 2026-07-29 10:11:12 UTC" in out


def test_title_omits_absent_fields() -> None:
    out = _render(title_section, EventObject(title="just a title"), MD, LIMITS_DEFAULT)
    assert out == "## Title\njust a title"


def test_frame_vars_trimmed_to_context_and_scrubbed() -> None:
    # only vars the frame's own source mentions survive, and scrubbed values are dropped
    frame = Frame(
        function="login",
        filename="a.py",
        line_no=2,
        context=[(1, "user = get_user(missing)"), (2, "check(password)")],
        vars={
            "password": "[Filtered]",
            "user": {"email": "[Filtered]", "id": 7},
            "missing": None,
            "unmentioned": "noise",
        },
    )
    event = _event_with_exception(type="E", stacktrace=Stacktrace(frames=[frame]))
    out = _render(exceptions_section, event, MD, LIMITS_DEFAULT)
    assert "[Filtered]" not in out
    # only the unscrubbed part of the one mentioned var survives; the source lines still render
    assert "vars: user={'id': 7}, missing=None" in out
    assert "password=" not in out
    assert "unmentioned" not in out


def test_frame_vars_scrubbed_without_context() -> None:
    # no source context to narrow against, so vars are kept -- but still never scrubbed values
    frame = Frame(function="f", filename="a.py", vars={"token": "[Filtered]", "count": 3})
    event = _event_with_exception(type="E", stacktrace=Stacktrace(frames=[frame]))
    out = _render(exceptions_section, event, MD, LIMITS_DEFAULT)
    assert "[Filtered]" not in out
    assert "token" not in out
    assert "count=3" in out


def test_frame_vars_keep_containers_that_arrived_empty() -> None:
    # an empty collection is often the bug itself, so it has to survive -- only a container that
    # scrubbing emptied out carries nothing and should go
    frame = Frame(
        function="f",
        filename="a.py",
        vars={"items": [], "opts": {}, "scrubbed": {"token": "[Filtered]"}},
    )
    event = _event_with_exception(type="E", stacktrace=Stacktrace(frames=[frame]))
    out = _render(exceptions_section, event, MD, LIMITS_DEFAULT)
    assert "items=[]" in out
    assert "opts={}" in out
    assert "scrubbed" not in out


def test_message_deduped_against_title() -> None:
    # message that is a substring of the title renders nothing
    assert (
        _render(
            message_section, EventObject(title="boom happened", message="boom"), MD, LIMITS_DEFAULT
        )
        == ""
    )
    # distinct message renders
    out = _render(
        message_section, EventObject(title="t", message="something else"), MD, LIMITS_DEFAULT
    )
    assert "something else" in out


def test_breadcrumbs_last_n_and_skip_filtered() -> None:
    crumbs = [Breadcrumb(message=f"crumb-{i}") for i in range(15)]
    crumbs.append(Breadcrumb(message="[Filtered]"))
    event = EventObject(title="t", breadcrumbs=crumbs)
    out = _render(breadcrumbs_section, event, MD, LIMITS_DEFAULT)  # max_breadcrumbs=10
    assert "[Filtered]" not in out  # filtered crumb skipped
    assert "crumb-14" in out  # most recent kept
    assert "crumb-6" in out  # boundary of the last-10 window (indices 6..15)
    assert "crumb-5" not in out  # older than the window, dropped
    body_lines = out.split("\n")[1:]  # drop the "## Breadcrumbs" heading line
    assert len(body_lines) == 9  # last 10 minus the one filtered crumb


def test_threads_zero_cap_renders_nothing() -> None:
    # same trap as the breadcrumb cap: testing the count after appending lets one thread through
    stacktrace = Stacktrace(frames=[Frame(function="f", filename="a.py")])
    event = EventObject(
        title="t",
        threads=[ThreadDetails(name=f"T{i}", stacktrace=stacktrace) for i in range(5)],
    )
    assert (
        _render(threads_section, event, MD, dataclasses.replace(LIMITS_DEFAULT, max_threads=0))
        == ""
    )
    # and the cap is still filled exactly when it is non-zero
    out = _render(threads_section, event, MD, dataclasses.replace(LIMITS_DEFAULT, max_threads=2))
    assert [f"T{i}" in out for i in range(5)] == [True, True, False, False, False]


def test_breadcrumbs_zero_cap_renders_nothing() -> None:
    # the window is a negative slice, so a zero cap becomes [0:] and would render every
    # breadcrumb -- the exact opposite of what the cap asks for
    event = EventObject(title="t", breadcrumbs=[Breadcrumb(message=f"c{i}") for i in range(5)])
    out = _render(
        breadcrumbs_section, event, MD, dataclasses.replace(LIMITS_DEFAULT, max_breadcrumbs=0)
    )
    assert out == ""


def test_breadcrumbs_all_filtered_renders_nothing() -> None:
    event = EventObject(title="t", breadcrumbs=[Breadcrumb(message="[Filtered]")])
    assert _render(breadcrumbs_section, event, MD, LIMITS_DEFAULT) == ""


def test_request_method_url_and_body() -> None:
    event = EventObject(
        title="t", request=RequestDetails(method="POST", url="https://x.com", data={"a": 1})
    )
    out = _render(request_section, event, MD, LIMITS_DEFAULT)
    assert "POST https://x.com" in out
    assert "{'a': 1}" in out


def test_request_none_renders_nothing() -> None:
    assert _render(request_section, EventObject(title="t"), MD, LIMITS_DEFAULT) == ""


def test_tags_section() -> None:
    event = EventObject(title="t", tags=[("environment", "prod"), ("release", None)])
    out = _render(tags_section, event, MD, LIMITS_DEFAULT)
    assert "**environment:** prod" in out
    assert "**release:** " in out


def test_tags_section_drops_the_derived_user_tag() -> None:
    # ingest sets sentry:user from the EventUser and the serializer exposes it as `user`, so
    # rendering it would put an identifier in the default output regardless of user_section
    event = EventObject(
        title="t",
        tags=[("user", "email:someone@example.com"), ("browser", "Chrome")],
        user=UserDetails(email="someone@example.com"),
    )
    out = format_issue({"title": "t", "tags": [{"key": k, "value": v} for k, v in event.tags]})
    assert "someone@example.com" not in out
    assert "**browser:** Chrome" in out
    # a tags block with nothing but the user tag renders nothing at all
    assert (
        _render(tags_section, EventObject(title="t", tags=[("user", "id:7")]), MD, LIMITS_DEFAULT)
        == ""
    )


def test_user_only_present_fields() -> None:
    event = EventObject(title="t", user=UserDetails(email="user@example.com"))
    out = _render(user_section, event, MD, LIMITS_DEFAULT)
    assert "**Email:** user@example.com" in out
    assert "ID" not in out


def test_contexts_renders_groups_and_skips_type() -> None:
    event = EventObject(
        title="t",
        contexts={
            "browser": {"type": "browser", "name": "Chrome", "version": "28"},
            "os": {"type": "os", "name": "Windows"},
        },
    )
    out = _render(contexts_section, event, MD, LIMITS_DEFAULT)
    assert "## Contexts" in out
    assert "browser\nname: Chrome\nversion: 28" in out
    assert "os\nname: Windows" in out
    assert "type:" not in out  # the redundant per-context type key is dropped


def test_csp_section() -> None:
    event = EventObject(
        title="t",
        csp=CspDetails(
            effective_directive="img-src", blocked_uri="blob", document_uri="https://x.com"
        ),
    )
    out = _render(csp_section, event, MD, LIMITS_DEFAULT)
    assert "## CSP" in out
    assert "**Blocked:** blob" in out
    assert "**Directive:** img-src" in out
    assert "**Document:** https://x.com" in out


def test_evidence_section() -> None:
    event = EventObject(
        title="t",
        evidence=[("Regression", "duration increased"), ("Transaction", "POST /oauth/token")],
    )
    out = _render(evidence_section, event, MD, LIMITS_DEFAULT)
    assert "## Evidence" in out
    assert "**Regression:** duration increased" in out
    assert "**Transaction:** POST /oauth/token" in out


@pytest.mark.parametrize("section", [csp_section, evidence_section, contexts_section])
def test_section_empty_renders_nothing(section: SectionFn) -> None:
    assert _render(section, EventObject(title="t"), MD, LIMITS_DEFAULT) == ""


def test_threads_only_with_stacktrace() -> None:
    with_st = ThreadDetails(
        name="main", crashed=True, stacktrace=Stacktrace(frames=[Frame(function="f", line_no=1)])
    )
    without_st = ThreadDetails(name="worker")
    event = EventObject(title="t", threads=[with_st, without_st])
    out = _render(threads_section, event, MD, LIMITS_DEFAULT)
    assert "main" in out
    assert "**Crashed:** Yes" in out
    assert "worker" not in out


def test_threads_capped_by_max_threads() -> None:
    # more threads than max_threads -> section output is bounded by the count cap
    frame = Frame(function="f", line_no=1)
    threads = [
        ThreadDetails(name=f"t{i}", stacktrace=Stacktrace(frames=[frame])) for i in range(20)
    ]
    event = EventObject(title="t", threads=threads)
    tight = dataclasses.replace(LIMITS_DEFAULT, max_threads=3)
    out = _render(threads_section, event, MD, tight)
    assert out.count("```") == 3 * 2  # one fenced stacktrace per rendered thread, capped at 3
    assert "t0" in out and "t2" in out
    assert "t3" not in out


def test_spans_section() -> None:
    event = EventObject(
        title="t", spans=[EvidenceSpan(op="db", description="SELECT 1", exclusive_time=12.5)]
    )
    out = _render(spans_section, event, MD, LIMITS_DEFAULT)
    assert "db: SELECT 1 (12.5ms)" in out


def test_spans_all_blank_renders_nothing() -> None:
    # spans present but every field empty -> no empty "## Span Evidence" block
    event = EventObject(title="t", spans=[EvidenceSpan(), EvidenceSpan()])
    assert _render(spans_section, event, MD, LIMITS_DEFAULT) == ""


def test_breadcrumbs_all_blank_renders_nothing() -> None:
    event = EventObject(title="t", breadcrumbs=[Breadcrumb(), Breadcrumb()])
    assert _render(breadcrumbs_section, event, MD, LIMITS_DEFAULT) == ""


def _serialized_event() -> dict[str, Any]:
    return {
        "eventID": "abc123",
        "title": "ValueError: boom",
        "entries": [
            {
                "type": "exception",
                "data": {
                    "values": [
                        {
                            "type": "ValueError",
                            "value": "boom",
                            "mechanism": {"handled": False},
                            "stacktrace": {
                                "frames": [{"function": "f", "filename": "a.py", "lineNo": 1}]
                            },
                        }
                    ]
                },
            },
            {"type": "breadcrumbs", "data": {"values": [{"message": "started"}]}},
        ],
    }


def test_format_issue_markdown_end_to_end() -> None:
    out = format_issue(_serialized_event(), format="markdown")
    assert "## Title\nValueError: boom" in out
    assert "## Exception" in out
    assert "**Handled:** No" in out
    assert "## Breadcrumbs" in out
    assert "started" in out


def test_format_issue_xml() -> None:
    out = format_issue(_serialized_event(), format="xml")
    assert "<title>" in out
    assert "<exception>" in out
    assert "<breadcrumbs>" in out


def test_detector_sections_render_when_present() -> None:
    # detector-backed issue types are the only ones that carry these two fields
    event = EventObject(
        title="t",
        detection_context="Opened by a Sentry detector, not an exception.",
        troubleshooting_hint="Remove the manually instrumented span.",
    )
    assert "Opened by a Sentry detector" in _render(
        detection_context_section, event, MD, LIMITS_DEFAULT
    )
    assert "Remove the manually instrumented" in _render(
        troubleshooting_hint_section, event, MD, LIMITS_DEFAULT
    )
    out = format_issue({"title": "t", "detectionContext": "why", "troubleshootingHint": "how"})
    assert "why" in out and "how" in out


@pytest.mark.parametrize("section", [detection_context_section, troubleshooting_hint_section])
@pytest.mark.parametrize("value", [None, ""])
def test_detector_sections_skipped_when_blank(section: Any, value: str | None) -> None:
    event = EventObject(title="t", detection_context=value, troubleshooting_hint=value)
    assert _render(section, event, MD, LIMITS_DEFAULT) == ""


def test_invalid_format_raises() -> None:
    with pytest.raises(ValueError):
        format_issue(_serialized_event(), format="banana")  # type: ignore[arg-type]


def test_unadaptable_payload_renders_nothing() -> None:
    # a payload the adapter can't map degrades to empty output instead of raising at the
    # caller; consumers treat empty as "no formatted output" and fall back
    assert format_issue({"title": "t", "entries": "not-a-list"}) == ""
    assert format_issue({}) == ""  # no title


def test_event_sections_order() -> None:
    names = [s.__name__ for s in EVENT_SECTIONS]
    assert names[0] == "title_section"
    assert names[-1] == "tags_section"  # user and contexts are opt-in, so they aren't here
    assert "exceptions_section" in names
    assert [s.__name__ for s in EVENT_SECTIONS_WITH_USER][-1] == "contexts_section"


def test_user_identifiers_are_opt_in() -> None:
    # the default list must not carry email/IP/username/ID into an LLM prompt; only a caller
    # that opts in with EVENT_SECTIONS_WITH_USER gets them
    assert user_section not in EVENT_SECTIONS
    assert user_section in EVENT_SECTIONS_WITH_USER
    # opting in changes nothing else about the render order
    assert [s.__name__ for s in EVENT_SECTIONS] == [
        s.__name__ for s in EVENT_SECTIONS_WITH_USER if s not in (user_section, contexts_section)
    ]

    data = {"title": "t", "user": {"email": "someone@example.com", "ipAddress": "203.0.113.7"}}
    assert "someone@example.com" not in format_issue(data)
    assert "someone@example.com" in format_issue(data, sections=EVENT_SECTIONS_WITH_USER)


def test_context_identifiers_are_opt_in() -> None:
    # contexts is an open-ended mapping that carries device and session ids, so it follows the
    # same rule as user_section rather than riding along in the default list
    assert contexts_section not in EVENT_SECTIONS
    assert contexts_section in EVENT_SECTIONS_WITH_USER

    data = {
        "title": "t",
        "contexts": {
            "device": {"name": "Phone", "device_unique_identifier": "F1D3-9C2A"},
            "replay": {"replay_id": "abc123"},
        },
    }
    out = format_issue(data)
    assert "F1D3-9C2A" not in out
    assert "abc123" not in out
    assert "F1D3-9C2A" in format_issue(data, sections=EVENT_SECTIONS_WITH_USER)


def test_bare_stacktrace_entry_renders() -> None:
    # events with no exception can still carry a top-level stacktrace entry
    event = EventObject(
        title="t",
        stacktrace=Stacktrace(frames=[Frame(function="do_thing", filename="app.py", line_no=12)]),
    )
    out = _render(stacktrace_section, event, MD, LIMITS_DEFAULT)
    assert out.startswith("## Stacktrace")
    assert "do_thing in app.py [Line 12]" in out


def test_bare_stacktrace_skipped_when_empty() -> None:
    assert _render(stacktrace_section, EventObject(title="t"), MD, LIMITS_DEFAULT) == ""
    event = EventObject(title="t", stacktrace=Stacktrace(frames=[]))
    assert _render(stacktrace_section, event, MD, LIMITS_DEFAULT) == ""


def test_exception_stacktrace_not_duplicated() -> None:
    # an exception-owned stacktrace renders inside the Exception block, not as its own section
    event = _event_with_exception(
        type="ValueError",
        value="boom",
        stacktrace=Stacktrace(frames=[Frame(function="f", filename="a.py", line_no=1)]),
    )
    out = format_issue(
        {
            "title": "ValueError: boom",
            "entries": [
                {
                    "type": "exception",
                    "data": {
                        "values": [
                            {
                                "type": "ValueError",
                                "value": "boom",
                                "stacktrace": {"frames": [{"function": "f", "filename": "a.py"}]},
                            }
                        ]
                    },
                }
            ],
        }
    )
    assert "## Exception" in out
    assert "## Stacktrace" not in out
    assert _render(stacktrace_section, event, MD, LIMITS_DEFAULT) == ""


def test_truncating_a_rendered_body_never_splits_markup() -> None:
    # section bodies are joins of already-rendered pieces, so slicing mid-way would cut through
    # a tag and leave the xml unparseable; whole pieces are dropped instead
    event = EventObject(
        title="t",
        exceptions=[
            ExceptionDetails(type=f"E{i}", value="v" * 40, is_handled=False) for i in range(4)
        ],
    )
    for cap in range(20, 260):
        out = _render(
            exceptions_section,
            event,
            XmlFormatter(),
            dataclasses.replace(LIMITS_DEFAULT, max_exceptions_chars=cap),
        )
        ElementTree.fromstring(out)  # raises if a tag was split


def test_truncating_a_rendered_body_keeps_markdown_fences_balanced() -> None:
    # the markdown equivalent of the check above: each piece is already fenced, so cutting
    # through one would drop its closing fence and swallow the rest of the output in a code block
    stacktrace = Stacktrace(
        frames=[Frame(function="f", filename="a.py", line_no=1, context=[(1, "x = 1")])]
    )
    event = EventObject(
        title="t",
        exceptions=[
            # backtick-heavy values, so a widened fence is in play too
            ExceptionDetails(type=f"E{i}", value="``` v " * 10, stacktrace=stacktrace)
            for i in range(4)
        ],
    )
    for cap in range(20, 600):
        out = _render(
            exceptions_section,
            event,
            MD,
            dataclasses.replace(LIMITS_DEFAULT, max_exceptions_chars=cap),
        )
        fences = [line for line in out.splitlines() if line and set(line) == {"`"}]
        assert len(fences) % 2 == 0, f"unbalanced fence at cap={cap}"


def test_capping_a_rendered_body_keeps_the_first_piece() -> None:
    # dropping every piece would leave a section carrying nothing but "(truncated)"; overshooting
    # the cap once beats losing the content the section exists to render
    event = EventObject(title="t", exceptions=[ExceptionDetails(type="E", value="v" * 200)])
    out = _render(
        exceptions_section, event, MD, dataclasses.replace(LIMITS_DEFAULT, max_exceptions_chars=10)
    )
    assert "E: " + "v" * 200 in out


def test_evidence_section_is_capped() -> None:
    # evidenceDisplay carries whatever pairs an occurrence defines, so it needs a cap like the
    # other open-ended sections rather than rendering unbounded
    event = EventObject(title="t", evidence=[("Regression", "x" * 10_000)])
    out = _render(evidence_section, event, MD, LIMITS_DEFAULT)
    assert "... (truncated)" in out
    assert len(out) < 6_000  # max_evidence_chars=5_000, plus the surrounding block


def test_contexts_render_key_value_pairs() -> None:
    event = EventObject(title="t", contexts={"browser": {"type": "browser", "name": "Chrome"}})
    out = _render(contexts_section, event, XmlFormatter(), LIMITS_DEFAULT)
    assert "name: Chrome" in out
    assert "type: browser" not in out  # the redundant echo is dropped


def test_evidence_truncation_never_splits_markup() -> None:
    # the body is a join of rendered <name>value</name> pieces, so a mid-way slice would leave
    # an unclosed tag
    event = EventObject(title="t", evidence=[("regression", "x" * 200), ("other", "y" * 200)])
    for cap in range(20, 400):
        out = _render(
            evidence_section,
            event,
            XmlFormatter(),
            dataclasses.replace(LIMITS_DEFAULT, max_evidence_chars=cap),
        )
        ElementTree.fromstring(out)  # raises if a tag was split
