"""Renders the event model into text or JSON.

Sections describe *what* to render (``sections.py``); formatters decide *how*. One section
list drives every format, so only the syntax differs between them. Caps live on the structure
because the families spend them differently: text cuts a joined body, JSON drops whole items.
"""

from __future__ import annotations

import logging
import re
from abc import ABC, abstractmethod
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Any, Literal, TypedDict, Union

from sentry.issues.formatting.limits import Limits
from sentry.issues.formatting.models import EventObject
from sentry.utils import json

logger = logging.getLogger(__name__)

_TRUNCATED = "... (truncated)"

# ``sentry.utils.json.dumps`` escapes non-ascii, which would spend six of the cap on a
# character the text formats spend one on, and leave \uXXXX through the content string.
_ENCODER = json.JSONEncoder(separators=(",", ":"), ignore_nan=True, ensure_ascii=False)


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
    """The item-dropping half of ``truncate_items``, for formats that keep structure."""
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


def _item_cost(item: Item) -> int:
    """Roughly what an item costs once rendered, for the drop-whole-items caps."""
    if isinstance(item, Field):
        return len(item.key) + len(item.value) + 2
    return len(item.text) + 1


@dataclass(frozen=True)
class Group:
    """One sub-block: a single exception or thread, or a whole body with no repeating
    structure. Items render one per line.
    """

    items: tuple[Item, ...]
    max_chars: int | None = None  # cut the joined body here
    max_item_chars: int | None = None  # drop whole items instead


@dataclass(frozen=True)
class Section:
    """One titled block of output. Groups render separated by a blank line."""

    title: str
    groups: tuple[Group, ...] = ()
    max_chars: int | None = None  # cut the joined body here
    max_group_chars: int | None = None  # drop whole groups instead


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

    A group becomes an object: fields under their slugged name, bare lines under ``text``,
    preformatted content under ``code``. Sections with several groups (exceptions, threads)
    become a list, so the repeating shape is visible rather than implied by blank lines.
    """

    def join(self, sections: Sequence[str]) -> str:
        # each entry is a serialized ``{"key": {...}}``; merging keeps section order
        merged: dict[str, Any] = {}
        for part in sections:
            merged.update(json.loads(part))
        return _ENCODER.encode(merged)

    def render_section(self, section: Section) -> str:
        groups = [self.render_group_object(group) for group in section.groups]
        groups = [g for g in groups if g]
        if not groups:
            return ""

        cap = section.max_group_chars if section.max_group_chars is not None else section.max_chars
        if cap is not None:
            costs = [len(_ENCODER.encode(g)) for g in groups]
            groups = _keep_within(groups, costs, cap)
        if not groups:
            return ""

        payload: Any = groups[0] if len(groups) == 1 else groups
        return _ENCODER.encode({slug(section.title): payload})

    def render_group_object(self, group: Group) -> dict[str, Any]:
        # every item kind, not just text: evidence builds an open-ended field list from
        # occurrence.evidenceDisplay, which the text formats bound and json otherwise would not
        items = [i for i in group.items if not (isinstance(i, Text) and not i.text)]
        cap = group.max_item_chars if group.max_item_chars is not None else group.max_chars
        if cap is not None:
            items = _keep_within(items, [_item_cost(i) for i in items], cap)

        fields: dict[str, Any] = {}
        text: list[str] = []
        code: list[str] = []
        for item in items:
            if isinstance(item, Field):
                fields[slug(item.key)] = item.value
            elif isinstance(item, Code):
                code.append(item.text)
            else:
                text.append(item.text)

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
