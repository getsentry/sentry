from __future__ import annotations

from html.parser import HTMLParser
from typing import Any

VOID_ELEMENTS = frozenset(
    "area base br col embed hr img input link meta source track wbr".split(),
)


class _HTMLTreeBuilder(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.root: list[Any] = []
        self._open: list[tuple[str, list[Any]]] = [("", self.root)]

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        # Unlike with `innerHTML`, scripts built with DOM APIs would run.
        if tag == "script":
            raise ValueError("Script elements are not supported")
        children: list[Any] = []
        self._open[-1][1].append([tag, {name: value or "" for name, value in attrs}, children])
        if tag not in VOID_ELEMENTS:
            self._open.append((tag, children))

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        # HTML ignores the slash in `<div/>`, only void elements have no end tag.
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag: str) -> None:
        for i in range(len(self._open) - 1, 0, -1):
            if self._open[i][0] == tag:
                del self._open[i:]
                return

    def handle_data(self, data: str) -> None:
        tag, children = self._open[-1]
        # Browsers drop the first newline in a textarea, which Django always renders.
        if tag == "textarea" and not children:
            data = data.removeprefix("\r").removeprefix("\n")
        if data:
            children.append(data)


def html_to_tree(html: str) -> list[Any]:
    """
    Converts trusted, well-formed HTML into nested `[tag, attributes, children]`
    lists, with text as plain strings, so that browsers can build it without
    `innerHTML`, which pages enforcing Trusted Types block.
    """
    builder = _HTMLTreeBuilder()
    builder.feed(html)
    builder.close()
    return builder.root
