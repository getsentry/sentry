import functools
from xml.etree import ElementTree

import pytest

from sentry.issues.formatting.formatter import (
    Code,
    Field,
    Formatter,
    Group,
    JsonFormatter,
    MarkdownFormatter,
    Section,
    SectionFn,
    Text,
    XmlFormatter,
    slug,
)
from sentry.issues.formatting.limits import LIMITS_DEFAULT, Limits
from sentry.issues.formatting.models import (
    EventObject,
)
from sentry.utils import json


def title_section(model: EventObject, limits: object) -> Section | None:
    return Section(title="Title", groups=(Group(items=(Text(model.title),)),))


def empty_section(model: EventObject, limits: object) -> Section | None:
    return None


def boom_section(model: EventObject, limits: object) -> Section | None:
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
    def boom(model: EventObject, limits: Limits) -> Section | None:
        raise ValueError("boom")

    def ok(model: EventObject, limits: Limits) -> Section | None:
        return Section(title="Ok", groups=(Group(items=(Text("survived"),)),))

    out = MarkdownFormatter().render(
        EventObject(title="t"), [functools.partial(boom), ok], LIMITS_DEFAULT
    )
    assert out == "## Ok\nsurvived"


@pytest.mark.parametrize("key", ["123abc", "\U0001f525", "###", "", "  ", "-x-"])
def test_slug_always_yields_a_legal_xml_name(key: str) -> None:
    # tag keys and evidence names come from the event, so a title can slug away to nothing or
    # start with a digit; either would emit <> or <123> and break the parse
    out = XmlFormatter().field(key, "v")
    ElementTree.fromstring(f"<r>{out}</r>")


def _fields_section(model: EventObject, limits: object) -> Section | None:
    return Section(
        title="HTTP Request",
        groups=(Group(items=(Text("GET /x"), Field("Method", "GET"), Code("body"))),),
    )


def _repeating_section(model: EventObject, limits: object) -> Section | None:
    return Section(
        title="Exception",
        groups=(
            Group(items=(Text("ValueError: a"),)),
            Group(items=(Text("KeyError: b"),)),
        ),
    )


def test_json_renders_a_section_as_an_object() -> None:
    out = JsonFormatter().render(EventObject(title="t"), [_fields_section], LIMITS_DEFAULT)
    assert json.loads(out) == {"http_request": {"method": "GET", "text": "GET /x", "code": "body"}}


def test_json_renders_repeating_groups_as_a_list() -> None:
    # the shape a consumer keys off has to be visible, not implied by blank lines the way it is
    # in the text formats
    out = JsonFormatter().render(EventObject(title="t"), [_repeating_section], LIMITS_DEFAULT)
    assert json.loads(out) == {"exception": [{"text": "ValueError: a"}, {"text": "KeyError: b"}]}


def test_json_merges_sections_into_one_object() -> None:
    out = JsonFormatter().render(
        EventObject(title="boom"), [title_section, _fields_section], LIMITS_DEFAULT
    )
    parsed = json.loads(out)
    assert list(parsed) == ["title", "http_request"]  # section order preserved


def test_json_skips_empty_and_failing_sections() -> None:
    out = JsonFormatter().render(
        EventObject(title="t"), [empty_section, boom_section, title_section], LIMITS_DEFAULT
    )
    assert json.loads(out) == {"title": {"text": "t"}}


def test_json_output_is_always_parseable() -> None:
    # the text formats degrade to a truncated string; json has to stay valid or the consumer
    # can't read any of it
    out = JsonFormatter().render(EventObject(title="t"), [], LIMITS_DEFAULT)
    assert json.loads(out) == {}


def test_every_format_sees_the_same_sections() -> None:
    # one section list, three renderings: if a format could change which sections run,
    # comparing them would measure the wrong thing
    event = EventObject(title="boom")
    sections = [title_section, _fields_section, _repeating_section]
    rendered = {
        "markdown": MarkdownFormatter().render(event, sections, LIMITS_DEFAULT),
        "xml": XmlFormatter().render(event, sections, LIMITS_DEFAULT),
        "json": JsonFormatter().render(event, sections, LIMITS_DEFAULT),
    }
    for out in rendered.values():
        assert "boom" in out and "GET /x" in out and "KeyError: b" in out
    assert set(json.loads(rendered["json"])) == {"title", "http_request", "exception"}


def _many_fields_section(model: EventObject, limits: object) -> Section | None:
    # what evidence_section builds: an open-ended field list bounded only by the cap
    return Section(
        title="Evidence",
        groups=(
            Group(
                items=tuple(Field(f"k{i}", "v" * 20) for i in range(50)),
                max_item_chars=100,
            ),
        ),
    )


def test_json_applies_the_item_cap_to_fields_not_just_text() -> None:
    # capping only free text would leave an open-ended field list unbounded in json, so the
    # format a caller asked for would change how much data they got
    event = EventObject(title="t")
    rendered = {
        fmt: fmt.render(event, [_many_fields_section], LIMITS_DEFAULT)
        for fmt in (MarkdownFormatter(), XmlFormatter(), JsonFormatter())
    }
    kept = json.loads(rendered[next(f for f in rendered if isinstance(f, JsonFormatter))])
    assert len(kept["evidence"]) < 50  # dropped whole pairs rather than keeping all of them

    # the cap is a character budget, so every format lands in the same envelope. Counts differ
    # slightly because the syntax costs differ, which is fine; an unbounded format is not.
    for out in rendered.values():
        assert len(out) < 2 * 100


@pytest.mark.parametrize(
    "fmt,expected",
    [(MarkdownFormatter(), ""), (XmlFormatter(), ""), (JsonFormatter(), "{}")],
)
def test_empty_render_is_valid_for_the_requested_format(fmt: Formatter, expected: str) -> None:
    # callers json.loads the content, and the no-run autofix GET takes this path routinely
    assert fmt.render(EventObject(title="t"), [], LIMITS_DEFAULT) == expected


def _unicode_section(model: EventObject, limits: object) -> Section | None:
    return Section(title="Tags", groups=(Group(items=(Field("ville", "café ünïcode"),)),))


def test_json_does_not_escape_non_ascii() -> None:
    # escaping would spend six of the cap on one accented character, so an international event
    # would lose sections an ascii event of the same size keeps
    out = JsonFormatter().render(EventObject(title="t"), [_unicode_section], LIMITS_DEFAULT)
    assert "café ünïcode" in out
    assert "\\u" not in out
    assert json.loads(out)["tags"]["ville"] == "café ünïcode"


def test_unicode_costs_the_same_against_the_cap_as_ascii() -> None:
    # the cap is a character budget; a format must not count one character as six
    def section(chars: str) -> SectionFn:
        return lambda model, limits: Section(
            title="Evidence",
            groups=tuple(Group(items=(Field(f"k{i}", chars * 10),)) for i in range(20)),
            max_group_chars=200,
        )

    event = EventObject(title="t")
    ascii_kept = len(
        json.loads(JsonFormatter().render(event, [section("a")], LIMITS_DEFAULT))["evidence"]
    )
    accented_kept = len(
        json.loads(JsonFormatter().render(event, [section("é")], LIMITS_DEFAULT))["evidence"]
    )
    assert ascii_kept == accented_kept
