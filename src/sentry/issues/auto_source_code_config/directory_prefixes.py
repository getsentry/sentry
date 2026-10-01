from __future__ import annotations

from collections import Counter
from collections.abc import Sequence
from typing import NamedTuple

DEFAULT_PREFIX_CAP = 200
_SLASH = "/"


class RankedPrefix(NamedTuple):
    path: str
    file_count: int


def directory_prefixes(path: str) -> list[str]:
    directories = _directory_segments(path)
    if not directories:
        return []

    prefixes: list[str] = []
    built: list[str] = []
    for segment in directories:
        built.append(segment)
        prefixes.append(_SLASH.join(built) + _SLASH)
    return prefixes


def rank_directory_prefixes(
    paths: Sequence[str], *, cap: int = DEFAULT_PREFIX_CAP
) -> list[RankedPrefix]:
    counts: Counter[str] = Counter()
    seen: set[str] = set()
    for path in paths:
        normalized = _normalize_separators(path)
        if normalized in seen:
            continue
        seen.add(normalized)
        counts.update(directory_prefixes(normalized))

    ranked = sorted(counts.items(), key=_rank_key)
    return [RankedPrefix(path, count) for path, count in ranked[:cap]]


def _normalize_separators(path: str) -> str:
    return path.replace("\\", _SLASH)


def _directory_segments(path: str) -> list[str]:
    normalized = _normalize_separators(path)
    absolute = normalized.startswith(_SLASH)
    segments = [segment for segment in normalized.split(_SLASH) if segment]
    if len(segments) <= 1:
        return []

    directories = segments[:-1]
    if absolute:
        directories[0] = f"{_SLASH}{directories[0]}"
    return directories


def _rank_key(item: tuple[str, int]) -> tuple[int, int, str]:
    path, count = item
    return (-count, path.count(_SLASH), path)
