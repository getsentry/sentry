from sentry.issues.formatting.formatter import (
    Formatter,
    MarkdownFormatter,
    XmlFormatter,
    slug,
)
from sentry.issues.formatting.models import EventObject


def title_section(model: EventObject, fmt: Formatter, limits: object) -> str:
    return fmt.block("Title", model.title)


def empty_section(model: EventObject, fmt: Formatter, limits: object) -> str:
    return ""


def boom_section(model: EventObject, fmt: Formatter, limits: object) -> str:
    raise ValueError("boom")


def test_markdown_renders_section() -> None:
    event = EventObject(title="ValueError: boom")
    out = MarkdownFormatter().render(event, [title_section], limits=None)
    assert out == "## Title\nValueError: boom"


def test_xml_renders_section_with_slugged_tag() -> None:
    event = EventObject(title="ValueError: boom")
    out = XmlFormatter().render(event, [title_section], limits=None)
    assert out == "<title>\nValueError: boom\n</title>"


def test_empty_sections_are_skipped() -> None:
    event = EventObject(title="t")
    out = MarkdownFormatter().render(event, [empty_section, title_section], limits=None)
    assert out == "## Title\nt"  # no leading blank from the empty section


def test_sections_joined_with_blank_line() -> None:
    event = EventObject(title="t")
    out = MarkdownFormatter().render(event, [title_section, title_section], limits=None)
    assert out == "## Title\nt\n\n## Title\nt"


def test_failing_section_does_not_sink_output() -> None:
    event = EventObject(title="t")
    out = MarkdownFormatter().render(event, [boom_section, title_section], limits=None)
    assert out == "## Title\nt"  # boom_section swallowed, title still rendered


def test_primitives() -> None:
    md = MarkdownFormatter()
    assert md.field("Handled", "No") == "**Handled:** No"
    assert md.code_block("SELECT 1", "sql") == "```sql\nSELECT 1\n```"

    xml = XmlFormatter()
    assert xml.field("Handled", "No") == "<handled>No</handled>"


def test_slug() -> None:
    assert slug("HTTP Request") == "http_request"
    assert slug("Exception") == "exception"
