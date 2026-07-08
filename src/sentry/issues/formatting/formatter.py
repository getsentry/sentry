"""The formatter: renders a flat event model into text (markdown or xml).

Subclasses supply the per-format syntax primitives (``block``/``field``/``code_block``);
the section list decides *what* is rendered and in what order. This mirrors Seer's
per-section approach, made format-polymorphic so one section list drives every format.

A "section" is a plain function ``(model, formatter, limits) -> str`` that reads the model
and emits text via the formatter's primitives, returning "" to render nothing. Sections and
limits live in their own modules; ``limits`` is typed loosely here until that module lands.
"""

from __future__ import annotations

import logging
import re
from abc import ABC, abstractmethod
from collections.abc import Callable, Sequence
from typing import Any

from sentry.issues.formatting.models import EventObject

logger = logging.getLogger(__name__)

SectionFn = Callable[["EventObject", "Formatter", Any], str]


def slug(title: str) -> str:
    """Turn a human title (e.g. "HTTP Request") into an xml-safe tag ("http_request")."""
    return re.sub(r"[^a-z0-9]+", "_", title.strip().lower()).strip("_")


class Formatter(ABC):
    def render(self, model: EventObject, sections: Sequence[SectionFn], limits: Any) -> str:
        parts: list[str] = []
        for section in sections:
            try:
                body = section(model, self, limits)
            except Exception:
                # one malformed section must not sink the whole output
                logger.warning("formatter.section_failed", extra={"section": section.__name__})
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
    def code_block(self, text: str, lang: str | None = None) -> str: ...


class MarkdownFormatter(Formatter):
    def block(self, title: str, body: str) -> str:
        return f"## {title}\n{body}"

    def field(self, key: str, value: str) -> str:
        return f"**{key}:** {value}"

    def code_block(self, text: str, lang: str | None = None) -> str:
        return f"```{lang or ''}\n{text}\n```"


class XmlFormatter(Formatter):
    def block(self, title: str, body: str) -> str:
        tag = slug(title)
        return f"<{tag}>\n{body}\n</{tag}>"

    def field(self, key: str, value: str) -> str:
        tag = slug(key)
        return f"<{tag}>{value}</{tag}>"

    def code_block(self, text: str, lang: str | None = None) -> str:
        return f'<code lang="{lang or ""}">{text}</code>'
