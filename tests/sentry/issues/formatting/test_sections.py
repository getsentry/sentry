import dataclasses

from sentry.issues.formatting.formatter import MarkdownFormatter, XmlFormatter
from sentry.issues.formatting.limits import LIMITS_DEFAULT
from sentry.issues.formatting.models import EventObject, ExceptionDetails, Frame, Stacktrace
from sentry.issues.formatting.sections import exceptions_section


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
