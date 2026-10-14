from __future__ import annotations

import re
from dataclasses import dataclass


class InvalidMarkedSection(ValueError):
    pass


@dataclass(frozen=True)
class MarkedSection:
    content_start: int
    content_end: int


def marked_section(source: str, name: str) -> MarkedSection | None:
    begin = f"# begin: {name}"
    end = f"# end: {name}"
    begin_lines = list(re.finditer(rf"(?m)^{re.escape(begin)}\r?$", source))
    end_lines = list(re.finditer(rf"(?m)^{re.escape(end)}\r?$", source))
    if source.count(begin) != len(begin_lines) or source.count(end) != len(end_lines):
        raise InvalidMarkedSection(f"malformed markers for {name!r}")
    if not begin_lines and not end_lines:
        return None
    if len(begin_lines) != 1 or len(end_lines) != 1:
        raise InvalidMarkedSection(f"expected one marker pair for {name!r}")

    begin_line = begin_lines[0]
    end_line = end_lines[0]
    content_start = begin_line.end()
    if content_start < len(source) and source[content_start] == "\n":
        content_start += 1
    content_end = end_line.start()
    if content_end < content_start:
        raise InvalidMarkedSection(f"markers are out of order for {name!r}")
    return MarkedSection(content_start, content_end)


def replace_marked_section(source: str, name: str, content: str) -> str:
    section = marked_section(source, name)
    if section is None:
        raise InvalidMarkedSection(f"missing markers for {name!r}")
    return source[: section.content_start] + content + source[section.content_end :]


def clear_marked_section(source: str, name: str) -> str:
    section = marked_section(source, name)
    if section is None:
        return source
    return source[: section.content_start] + source[section.content_end :]
