import functools
from xml.etree import ElementTree

import pytest

from sentry.issues.formatting.formatter import (
    Formatter,
    MarkdownFormatter,
    XmlFormatter,
    slug,
)
from sentry.issues.formatting.limits import LIMITS_DEFAULT, Limits
from sentry.issues.formatting.models import (
    EventObject,
)


def title_section(model: EventObject, fmt: Formatter, limits: object) -> str:
    return fmt.block("Title", model.title)


def empty_section(model: EventObject, fmt: Formatter, limits: object) -> str:
    return ""


def boom_section(model: EventObject, fmt: Formatter, limits: object) -> str:
    raise ValueError("boom")


def test_markdown_renders_section() -> None:
    event = EventObject(title="ValueError: boom")
    out = MarkdownFormatter().render(event, [title_section], limits=LIMITS_DEFAULT)
    assert out == "## Title\nValueError: boom"


def test_xml_renders_section_with_slugged_tag() -> None:
    event = EventObject(title="ValueError: boom")
    out = XmlFormatter().render(event, [title_section], limits=LIMITS_DEFAULT)
    assert out == "<title>\nValueError: boom\n</title>"


def test_empty_sections_are_skipped() -> None:
    event = EventObject(title="t")
    out = MarkdownFormatter().render(event, [empty_section, title_section], limits=LIMITS_DEFAULT)
    assert out == "## Title\nt"  # no leading blank from the empty section


def test_sections_joined_with_blank_line() -> None:
    event = EventObject(title="t")
    out = MarkdownFormatter().render(event, [title_section, title_section], limits=LIMITS_DEFAULT)
    assert out == "## Title\nt\n\n## Title\nt"


def test_failing_section_does_not_sink_output() -> None:
    event = EventObject(title="t")
    out = MarkdownFormatter().render(event, [boom_section, title_section], limits=LIMITS_DEFAULT)
    assert out == "## Title\nt"  # boom_section swallowed, title still rendered


def test_primitives() -> None:
    md = MarkdownFormatter()
    assert md.field("Handled", "No") == "**Handled:** No"
    assert md.code_block("SELECT 1") == "```\nSELECT 1\n```"

    xml = XmlFormatter()
    assert xml.field("Handled", "No") == "<handled>No</handled>"
    assert xml.code_block("SELECT 1") == "<code>SELECT 1</code>"


def test_slug() -> None:
    assert slug("HTTP Request") == "http_request"
    assert slug("Exception") == "exception"


@pytest.mark.parametrize(
    "text,expected_fence",
    [
        ("x = 1", "```"),
        ("a ``` b", "````"),
        ("a ````` b", "``````"),
        ("a ` b", "```"),
    ],
)
def test_code_fence_outruns_backticks_in_content(text: str, expected_fence: str) -> None:
    # event content reaches code_block verbatim, so a stacktrace or request body carrying
    # backticks must not be able to close the block early and inject markdown after it
    out = MarkdownFormatter().code_block(text)
    assert out == f"{expected_fence}\n{text}\n{expected_fence}"


def test_failing_section_without_a_name_does_not_escape() -> None:
    # the handler exists so one bad section can't sink the render; reading __name__ off an
    # arbitrary callable would make the handler itself raise
    def boom(model: EventObject, fmt: Formatter, limits: Limits) -> str:
        raise ValueError("boom")

    def ok(model: EventObject, fmt: Formatter, limits: Limits) -> str:
        return "survived"

    out = MarkdownFormatter().render(
        EventObject(title="t"), [functools.partial(boom), ok], LIMITS_DEFAULT
    )
    assert out == "survived"


@pytest.mark.parametrize("key", ["123abc", "\U0001f525", "###", "", "  ", "-x-"])
def test_slug_always_yields_a_legal_xml_name(key: str) -> None:
    # tag keys and evidence names come from the event, so a title can slug away to nothing or
    # start with a digit; either would emit <> or <123> and break the parse
    out = XmlFormatter().field(key, "v")
    ElementTree.fromstring(f"<r>{out}</r>")
