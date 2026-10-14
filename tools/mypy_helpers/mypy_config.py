from __future__ import annotations

import json
import os
import re
import tomllib
from pathlib import Path


class InvalidMypyConfig(ValueError):
    pass


def relocate_path_options(source: str, source_root: Path) -> str:
    try:
        config = tomllib.loads(source)
    except tomllib.TOMLDecodeError as exc:
        raise InvalidMypyConfig(str(exc)) from exc
    tool = config.get("tool", {})
    mypy = tool.get("mypy", {}) if isinstance(tool, dict) else {}
    if not isinstance(mypy, dict):
        raise InvalidMypyConfig("[tool.mypy] must be a table")

    header = re.search(r"(?m)^\[tool\.mypy\][ \t]*$", source)
    if header is None:
        raise InvalidMypyConfig("missing [tool.mypy] table")
    following_header = re.search(
        r"(?m)^\[\[?[^\n]+\]\][ \t]*$|^\[[^\n]+\][ \t]*$",
        source[header.end() :],
    )
    table_end = header.end() + following_header.start() if following_header else len(source)
    table = source[header.end() : table_end]
    replacements: list[tuple[int, int, str]] = []

    for key in ("files", "mypy_path"):
        values = mypy.get(key)
        if values is None:
            continue
        if not isinstance(values, list) or not all(isinstance(value, str) for value in values):
            raise InvalidMypyConfig(f"[tool.mypy].{key} must be an array of paths")
        assignment = re.search(rf"(?m)^[ \t]*{re.escape(key)}[ \t]*=", table)
        if assignment is None:
            raise InvalidMypyConfig(f"could not locate [tool.mypy].{key} in source text")
        value_start = assignment.end()
        value_end = _toml_value_end(table, value_start)
        relocated = []
        for value in values:
            is_file_selector = key == "mypy_path" or _is_path_selector(value, source_root)
            relocated.append(
                os.path.abspath(source_root / value) if is_file_selector and not os.path.isabs(value) else value
            )
        rendered = " " + json.dumps(relocated, ensure_ascii=False)
        replacements.append((value_start, value_end, rendered))

    for start, end, replacement in reversed(replacements):
        source_start = header.end() + start
        source_end = header.end() + end
        source = source[:source_start] + replacement + source[source_end:]
    return source


def _is_path_selector(value: str, source_root: Path) -> bool:
    return (
        os.path.isabs(value)
        or value in {".", ".."}
        or "/" in value
        or "\\" in value
        or any(character in value for character in "*?[")
        or (source_root / value).exists()
    )


def _toml_value_end(source: str, start: int) -> int:
    quote: str | None = None
    escaped = False
    depth = 0
    for index in range(start, len(source)):
        character = source[index]
        if quote is not None:
            if quote == '"' and escaped:
                escaped = False
            elif quote == '"' and character == "\\":
                escaped = True
            elif character == quote:
                quote = None
            continue
        if character in {'"', "'"}:
            quote = character
        elif character == "[":
            depth += 1
        elif character == "]":
            depth -= 1
        elif character == "#" and depth == 0:
            return source.find("\n", index) if "\n" in source[index:] else len(source)
        elif character == "\n" and depth == 0:
            return index
    if quote is not None or depth != 0:
        raise InvalidMypyConfig("unterminated path option value")
    return len(source)
