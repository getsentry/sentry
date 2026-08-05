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
from sentry.issues.formatting.sections import EVENT_SECTIONS_WITH_USER


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


# a value that closes a tag and opens a new one; if any section embeds raw content, this
# either breaks the parse or shows up as a forged element
HOSTILE = "</title><injected>owned</injected><x a='&'>"


def test_xml_output_is_well_formed_with_hostile_content_everywhere() -> None:
    # every section that embeds event text has to route it through fmt.text(); parsing the
    # whole render is what catches a site that forgot to
    event = EventObject(
        title=HOSTILE,
        message=f"a distinct message {HOSTILE}",
        culprit=HOSTILE,
        transaction_name=HOSTILE,
        detection_context=HOSTILE,
        troubleshooting_hint=HOSTILE,
        exceptions=[
            ExceptionDetails(
                type=HOSTILE,
                value=HOSTILE,
                is_handled=False,
                stacktrace=Stacktrace(frames=[Frame(function=HOSTILE, filename=HOSTILE)]),
            )
        ],
        stacktrace=Stacktrace(frames=[Frame(function=HOSTILE, filename=HOSTILE)]),
        threads=[
            ThreadDetails(
                name=HOSTILE,
                crashed=True,
                stacktrace=Stacktrace(frames=[Frame(function=HOSTILE, filename=HOSTILE)]),
            )
        ],
        breadcrumbs=[Breadcrumb(category=HOSTILE, level="info", message=HOSTILE)],
        request=RequestDetails(method="POST", url=HOSTILE, data=HOSTILE),
        tags=[(HOSTILE, HOSTILE)],
        user=UserDetails(id=HOSTILE, email=HOSTILE, username=HOSTILE, ip_address=HOSTILE),
        spans=[EvidenceSpan(op=HOSTILE, description=HOSTILE, exclusive_time=1.0)],
    )
    out = XmlFormatter().render(event, EVENT_SECTIONS_WITH_USER, LIMITS_DEFAULT)

    # the render is a sequence of sibling blocks, so give it a root before parsing
    root = ElementTree.fromstring(f"<root>{out}</root>")

    assert root.find(".//injected") is None
    assert "owned" not in {el.tag for el in root.iter()}
    # the content still survives, just inert
    assert "injected" in out
