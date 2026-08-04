"""Renders the event model into text. Subclasses supply the per-format syntax primitives
(``block``/``field``/``code_block``); the section list decides what is rendered, so one
section list drives every format. Sections live in ``sections.py``.
"""

from __future__ import annotations

import logging
import re
from abc import ABC, abstractmethod
from collections.abc import Callable, Sequence

from sentry.issues.formatting.limits import Limits
from sentry.issues.formatting.models import EventObject

logger = logging.getLogger(__name__)

SectionFn = Callable[["EventObject", "Formatter", Limits], str]


def slug(title: str) -> str:
    """Turn a human title (e.g. "HTTP Request") into an xml-safe tag ("http_request")."""
    return re.sub(r"[^a-z0-9]+", "_", title.strip().lower()).strip("_")


class Formatter(ABC):
    def render(self, model: EventObject, sections: Sequence[SectionFn], limits: Limits) -> str:
        parts: list[str] = []
        for section in sections:
            try:
                body = section(model, self, limits)
            except Exception:
                # one malformed section must not sink the whole output, so this handler must
                # not raise either: a section need only be callable, not a named function
                logger.exception(
                    "formatter.section_failed",
                    extra={"section": getattr(section, "__name__", repr(section))},
                )
                continue
            if body:
                parts.append(body)
        return "\n\n".join(parts)

    # syntax primitives: the only thing that differs per format
    @abstractmethod
    def block(self, title: str, body: str) -> str: ...

    @abstractmethod
    def field(self, key: str, value: str) -> str: ...

    @abstractmethod
    def code_block(self, text: str) -> str: ...


class MarkdownFormatter(Formatter):
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


class XmlFormatter(Formatter):
    def block(self, title: str, body: str) -> str:
        tag = slug(title)
        return f"<{tag}>\n{body}\n</{tag}>"

    def field(self, key: str, value: str) -> str:
        tag = slug(key)
        return f"<{tag}>{value}</{tag}>"

    def code_block(self, text: str) -> str:
        return f"<code>{text}</code>"
