import dataclasses
from datetime import datetime

from sentry.issues.formatting.formatter import MarkdownFormatter, XmlFormatter
from sentry.issues.formatting.limits import LIMITS_DEFAULT
from sentry.issues.formatting.models import (
    Breadcrumb,
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
    breadcrumbs_section,
    exceptions_section,
    issue_meta_section,
    message_section,
    request_section,
    spans_section,
    tags_section,
    threads_section,
    title_section,
    user_section,
)

MD = MarkdownFormatter()


def _event_with_exception(**exc_kwargs) -> EventObject:
    return EventObject(title="t", exceptions=[ExceptionDetails(**exc_kwargs)])


def test_no_exceptions_renders_nothing() -> None:
    out = exceptions_section(EventObject(title="t"), MarkdownFormatter(), LIMITS_DEFAULT)
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
    out = exceptions_section(event, MarkdownFormatter(), LIMITS_DEFAULT)
    assert out.startswith("## Exception\n")
    assert "ValueError: boom" in out
    assert "**Handled:** No" in out
    assert "do_thing in app.py [Line 42] (In app)" in out
    assert "raise ValueError('boom')  <-- SUSPECT LINE" in out
    assert "x = 1\n" in out  # non-suspect context line, no marker


def test_handled_omitted_when_none() -> None:
    event = _event_with_exception(type="ValueError", value="boom")  # is_handled defaults None
    out = exceptions_section(event, MarkdownFormatter(), LIMITS_DEFAULT)
    assert "Handled" not in out


def test_frames_capped_and_most_recent_first() -> None:
    frames = [Frame(function=f"f{i}", filename="a.py", line_no=i) for i in range(20)]
    event = _event_with_exception(type="E", stacktrace=Stacktrace(frames=frames))
    out = exceptions_section(event, MarkdownFormatter(), LIMITS_DEFAULT)
    # default cap is 16 frames; last 16 kept (f4..f19), most-recent first
    assert "f19 in a.py" in out
    assert "f4 in a.py" in out
    assert "f3 in a.py" not in out
    assert out.index("f19") < out.index("f4")  # reversed order
    assert out.count(" in a.py ") == 16


def test_stacktrace_char_truncation() -> None:
    frames = [Frame(function="f", filename="a.py", line_no=1)]
    event = _event_with_exception(type="E", stacktrace=Stacktrace(frames=frames))
    tight = dataclasses.replace(LIMITS_DEFAULT, max_stacktrace_chars=10)
    out = exceptions_section(event, MarkdownFormatter(), tight)
    assert "(truncated)" in out


def test_xml_output() -> None:
    event = _event_with_exception(type="ValueError", value="boom")
    out = exceptions_section(event, XmlFormatter(), LIMITS_DEFAULT)
    assert out.startswith("<exception>\n")
    assert out.endswith("\n</exception>")
    assert "ValueError: boom" in out


def test_title_with_culprit() -> None:
    event = EventObject(title="ValueError: boom", culprit="app.views.checkout")
    out = title_section(event, MD, LIMITS_DEFAULT)
    assert "ValueError: boom" in out
    assert "**Culprit:** app.views.checkout" in out


def test_message_deduped_against_title() -> None:
    # message that is a substring of the title renders nothing
    assert (
        message_section(EventObject(title="boom happened", message="boom"), MD, LIMITS_DEFAULT)
        == ""
    )
    # distinct message renders
    out = message_section(EventObject(title="t", message="something else"), MD, LIMITS_DEFAULT)
    assert "something else" in out


def test_breadcrumbs_last_n_and_skip_filtered() -> None:
    crumbs = [Breadcrumb(message=f"crumb-{i}") for i in range(15)]
    crumbs.append(Breadcrumb(message="[Filtered]"))
    event = EventObject(title="t", breadcrumbs=crumbs)
    out = breadcrumbs_section(event, MD, LIMITS_DEFAULT)  # max_breadcrumbs=10
    assert "[Filtered]" not in out  # filtered crumb skipped
    assert "crumb-14" in out  # most recent kept
    assert "crumb-6" in out  # boundary of the last-10 window (indices 6..15)
    assert "crumb-5" not in out  # older than the window, dropped
    body_lines = out.split("\n")[1:]  # drop the "## Breadcrumbs" heading line
    assert len(body_lines) == 9  # last 10 minus the one filtered crumb


def test_breadcrumbs_all_filtered_renders_nothing() -> None:
    event = EventObject(title="t", breadcrumbs=[Breadcrumb(message="[Filtered]")])
    assert breadcrumbs_section(event, MD, LIMITS_DEFAULT) == ""


def test_request_method_url_and_body() -> None:
    event = EventObject(
        title="t", request=RequestDetails(method="POST", url="https://x.com", data={"a": 1})
    )
    out = request_section(event, MD, LIMITS_DEFAULT)
    assert "POST https://x.com" in out
    assert "{'a': 1}" in out


def test_request_none_renders_nothing() -> None:
    assert request_section(EventObject(title="t"), MD, LIMITS_DEFAULT) == ""


def test_tags_section() -> None:
    event = EventObject(title="t", tags=[("environment", "prod"), ("release", None)])
    out = tags_section(event, MD, LIMITS_DEFAULT)
    assert "**environment:** prod" in out
    assert "**release:** " in out


def test_user_only_present_fields() -> None:
    event = EventObject(title="t", user=UserDetails(email="user@example.com"))
    out = user_section(event, MD, LIMITS_DEFAULT)
    assert "**Email:** user@example.com" in out
    assert "ID" not in out


def test_threads_only_with_stacktrace() -> None:
    with_st = ThreadDetails(
        name="main", crashed=True, stacktrace=Stacktrace(frames=[Frame(function="f", line_no=1)])
    )
    without_st = ThreadDetails(name="worker")
    event = EventObject(title="t", threads=[with_st, without_st])
    out = threads_section(event, MD, LIMITS_DEFAULT)
    assert "main" in out
    assert "**Crashed:** Yes" in out
    assert "worker" not in out


def test_spans_section() -> None:
    event = EventObject(
        title="t", spans=[EvidenceSpan(op="db", description="SELECT 1", exclusive_time_ms=12.5)]
    )
    out = spans_section(event, MD, LIMITS_DEFAULT)
    assert "db: SELECT 1 (12.5ms)" in out


def test_issue_meta_present_fields() -> None:
    event = EventObject(
        title="t",
        short_id="PROJ-1",
        status="unresolved",
        count=42,
        first_seen=datetime(2024, 1, 1),
    )
    out = issue_meta_section(event, MD, LIMITS_DEFAULT)
    assert "**Issue ID:** PROJ-1" in out
    assert "**Events:** 42" in out
    assert "Level" not in out  # absent field omitted


def test_issue_meta_empty_for_bare_event() -> None:
    assert issue_meta_section(EventObject(title="t"), MD, LIMITS_DEFAULT) == ""
