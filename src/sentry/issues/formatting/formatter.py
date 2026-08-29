"""Renders the event model into text or JSON.

Sections return a structured ``Section`` (see ``sections.py``) describing *what* to render;
formatters decide *how*. Text formats (markdown, xml) supply the syntax primitives
(``block``/``field``/``code_block``); the JSON format serializes the same structure instead.
One section list drives every format, so the data a caller gets is identical whichever
format they ask for -- only the syntax differs.

Size caps live on the structure rather than in the sections, because the two families apply
them differently: text formats cut a joined body mid-string, JSON drops whole items so the
result stays parseable.
"""

from __future__ import annotations

import json
import logging
import re
from abc import ABC, abstractmethod
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Any, Literal, TypedDict, Union

from sentry.issues.formatting.limits import Limits
from sentry.issues.formatting.models import EventObject

logger = logging.getLogger(__name__)

_TRUNCATED = "... (truncated)"


def slug(title: str) -> str:
    """Turn a human title (e.g. "HTTP Request") into an xml-safe tag ("http_request")."""
    name = re.sub(r"[^a-z0-9]+", "_", title.strip().lower()).strip("_")
    # tag keys and evidence names come from the event, so this has to cope with titles that
    # slug away to nothing or start with a digit -- neither is a legal xml name on its own
    if not name or name[0].isdigit():
        name = f"_{name}"
    return name


def truncate(text: str, max_chars: int | None) -> str:
    """Cap a run of plain text. Only for content the formatter has not marked up yet -- use
    ``truncate_items`` once a body is a join of rendered pieces.
    """
    if max_chars is None or len(text) <= max_chars:
        return text
    return text[:max_chars].rstrip() + f"\n{_TRUNCATED}"


def truncate_items(items: Sequence[str], sep: str, max_chars: int | None) -> str:
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


def _keep_within(items: Sequence[Any], costs: Sequence[int], max_chars: int | None) -> list[Any]:
    """The item-dropping half of ``truncate_items``, for formats that keep structure.

    Mirrors its accounting exactly (first item always kept, separator charged from the second
    on) so JSON drops at the same boundary the text formats do.
    """
    if max_chars is None:
        return list(items)

    kept: list[Any] = []
    total = 0
    for item, cost in zip(items, costs):
        if kept and total + cost > max_chars:
            break
        kept.append(item)
        total += cost
    return kept


@dataclass(frozen=True)
class Field:
    """A key/value pair. ``**Key:** value`` in markdown, ``<key>value</key>`` in xml."""

    key: str
    value: str


@dataclass(frozen=True)
class Code:
    """Preformatted content -- a stacktrace, a request body."""

    text: str


@dataclass(frozen=True)
class Text:
    """A bare line carrying no key of its own (an exception header, a breadcrumb)."""

    text: str


Item = Union[Field, Code, Text]


@dataclass(frozen=True)
class Group:
    """One sub-block of a section: a single exception, a single thread, or the whole body of a
    section that has no repeating structure. Items render one per line.
    """

    items: tuple[Item, ...]
    # cut the joined body at this many characters (text formats) / drop whole items (JSON)
    max_chars: int | None = None
    # drop whole items rather than cutting the join, in both families
    max_item_chars: int | None = None


@dataclass(frozen=True)
class Section:
    """One titled block of output. Groups render separated by a blank line."""

    title: str
    groups: tuple[Group, ...] = ()
    # cut the joined body at this many characters (text formats) / drop whole groups (JSON)
    max_chars: int | None = None
    # drop whole groups rather than cutting the join, in both families
    max_group_chars: int | None = None


SectionFn = Callable[["EventObject", Limits], Union[Section, None]]


class Formatter(ABC):
    def render(self, model: EventObject, sections: Sequence[SectionFn], limits: Limits) -> str:
        rendered: list[str] = []
        for section in sections:
            try:
                built = section(model, limits)
            except Exception:
                # one malformed section must not sink the whole output, so this handler must
                # not raise either: a section need only be callable, not a named function
                logger.exception(
                    "formatter.section_failed",
                    extra={"section": getattr(section, "__name__", repr(section))},
                )
                continue
            if built is None or not built.groups:
                continue
            try:
                body = self.render_section(built)
            except Exception:
                logger.exception("formatter.section_render_failed", extra={"section": built.title})
                continue
            if body:
                rendered.append(body)
        return self.join(rendered)

    @abstractmethod
    def render_section(self, section: Section) -> str: ...

    @abstractmethod
    def join(self, sections: Sequence[str]) -> str: ...


class TextFormatter(Formatter):
    """Shared assembly for the line-oriented formats. Subclasses supply only the syntax."""

    def join(self, sections: Sequence[str]) -> str:
        return "\n\n".join(sections)

    def render_section(self, section: Section) -> str:
        groups = [self.render_group(group) for group in section.groups]
        groups = [g for g in groups if g]
        if not groups:
            return ""
        if section.max_group_chars is not None:
            body = truncate_items(groups, "\n\n", section.max_group_chars)
        else:
            body = truncate("\n\n".join(groups), section.max_chars)
        return self.block(section.title, body)

    def render_group(self, group: Group) -> str:
        lines = [self.render_item(item) for item in group.items]
        lines = [line for line in lines if line]
        if not lines:
            return ""
        if group.max_item_chars is not None:
            return truncate_items(lines, "\n", group.max_item_chars)
        return truncate("\n".join(lines), group.max_chars)

    def render_item(self, item: Item) -> str:
        if isinstance(item, Field):
            return self.field(item.key, item.value)
        if isinstance(item, Code):
            return self.code_block(item.text)
        return item.text

    # syntax primitives: the only thing that differs per text format
    @abstractmethod
    def block(self, title: str, body: str) -> str: ...

    @abstractmethod
    def field(self, key: str, value: str) -> str: ...

    @abstractmethod
    def code_block(self, text: str) -> str: ...


class MarkdownFormatter(TextFormatter):
    def block(self, title: str, body: str) -> str:
        return f"## {title}\n{body}"

    def field(self, key: str, value: str) -> str:
        return f"**{key}:** {value}"

    def code_block(self, text: str) -> str:
        # event content reaches here verbatim, so the fence has to outrun any backtick run
        # inside it -- otherwise a stacktrace or request body closes the block early
        longest = max((len(run) for run in re.findall(r"`+", text)), default=0)
        fence = "`" * max(3, longest + 1)
        return f"{fence}\n{text}\n{fence}"


class XmlFormatter(TextFormatter):
    def block(self, title: str, body: str) -> str:
        tag = slug(title)
        return f"<{tag}>\n{body}\n</{tag}>"

    def field(self, key: str, value: str) -> str:
        tag = slug(key)
        return f"<{tag}>{value}</{tag}>"

    def code_block(self, text: str) -> str:
        return f"<code>{text}</code>"


class JsonFormatter(Formatter):
    """Serializes the section structure instead of rendering it to lines.

    A group becomes an object: fields keyed by their slugged name, bare lines under ``text``,
    preformatted content under ``code``. A section with one group is that object; a section
    with several (exceptions, threads) is a list of them, so the repeating shape is visible to
    a consumer rather than implied by blank lines.
    """

    def join(self, sections: Sequence[str]) -> str:
        # every entry is already a serialized ``{"key": {...}}`` fragment; merging the parsed
        # objects keeps section order while producing one top-level object
        merged: dict[str, Any] = {}
        for part in sections:
            merged.update(json.loads(part))
        return json.dumps(merged, ensure_ascii=False)

    def render_section(self, section: Section) -> str:
        groups = [self.render_group_object(group) for group in section.groups]
        groups = [g for g in groups if g]
        if not groups:
            return ""

        cap = section.max_group_chars if section.max_group_chars is not None else section.max_chars
        if cap is not None:
            costs = [len(json.dumps(g, ensure_ascii=False)) for g in groups]
            groups = _keep_within(groups, costs, cap)
        if not groups:
            return ""

        payload: Any = groups[0] if len(groups) == 1 else groups
        return json.dumps({slug(section.title): payload}, ensure_ascii=False)

    def render_group_object(self, group: Group) -> dict[str, Any]:
        fields: dict[str, Any] = {}
        text: list[str] = []
        code: list[str] = []
        for item in group.items:
            if isinstance(item, Field):
                fields[slug(item.key)] = item.value
            elif isinstance(item, Code):
                code.append(item.text)
            elif item.text:
                text.append(item.text)

        cap = group.max_item_chars if group.max_item_chars is not None else group.max_chars
        if cap is not None and text:
            # only the free-text runs are open-ended enough to need the cap; fields and code
            # are already bounded by the section that built them
            costs = [len(line) + 1 for line in text]
            text = _keep_within(text, costs, cap)

        obj: dict[str, Any] = dict(fields)
        if text:
            obj["text"] = text[0] if len(text) == 1 else text
        if code:
            obj["code"] = code[0] if len(code) == 1 else code
        return obj


Format = Literal["markdown", "xml", "json"]

# Who the output is being rendered for. The UI and API clients ramp on separate features and
# want different sections from the same endpoint, so adapters take this alongside the format.
Consumer = Literal["ui", "api"]


class FormattedResponse(TypedDict):
    """The ``formatted`` field the mixin adds to a response when ``?llmFormat`` is requested.

    ``content`` is text for the text formats and a serialized JSON object for ``json``, so the
    response shape is the same whichever format a caller asks for.
    """

    format: Format
    content: str


_FORMATTERS: dict[Format, type[Formatter]] = {
    "markdown": MarkdownFormatter,
    "xml": XmlFormatter,
    "json": JsonFormatter,
}


def get_formatter(format: Format) -> Formatter:
    try:
        return _FORMATTERS[format]()
    except KeyError:
        raise ValueError(f"unsupported format: {format!r}") from None
