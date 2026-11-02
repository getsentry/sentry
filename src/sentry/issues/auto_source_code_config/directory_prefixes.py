from __future__ import annotations

from collections import Counter
from collections.abc import Sequence
from typing import NamedTuple

DEFAULT_PREFIX_CAP = 200
_SLASH = "/"
_BACKSLASH = "\\"


class RankedPrefix(NamedTuple):
    path: str
    file_count: int


def directory_prefixes(path: str) -> list[str]:
    scheme, remainder = _peel_scheme(path)
    sep = _detect_separator(remainder)
    prefixes = _prefix_slices(remainder, sep)

    if scheme:
        # Emit the bare scheme first; prepend it to each later prefix so each
        # result is a literal slice of the original frame path.
        return [scheme] + [scheme + p for p in prefixes]
    return prefixes


def rank_directory_prefixes(
    paths: Sequence[str], *, cap: int = DEFAULT_PREFIX_CAP
) -> list[RankedPrefix]:
    counts: Counter[str] = Counter()
    seen: set[str] = set()
    for path in paths:
        # src/foo.py and src\foo.py are different stack roots; treat as distinct.
        if path in seen:
            continue
        seen.add(path)
        counts.update(directory_prefixes(path))

    ranked = sorted(counts.items(), key=_rank_key)
    return [RankedPrefix(path, count) for path, count in ranked[:cap]]


def _peel_scheme(path: str) -> tuple[str, str]:
    # Cuts inside scheme:/// (e.g. app:/, webpack:/) are not valid prefix options.
    idx = path.find(":///")
    if idx > 0:
        scheme = path[: idx + 4]
        return scheme, path[idx + 4 :]
    return "", path


def _detect_separator(path: str) -> str:
    # Keep the path's own separator so each prefix is a literal slice of the
    # original frame, which is what startswith checks in code_mapping.py.
    return _SLASH if _SLASH in path else _BACKSLASH


def _prefix_slices(path: str, sep: str) -> list[str]:
    prefixes = []
    for i, ch in enumerate(path):
        if ch != sep:
            continue
        prefix = path[: i + 1]
        # Skip a prefix made entirely of separators — no directory content to suggest.
        if prefix.strip(sep):
            prefixes.append(prefix)
    return prefixes


def _rank_key(item: tuple[str, int]) -> tuple[int, int, str]:
    path, count = item
    # Count both separators so src\foo\ ranks deeper than src\ when counts tie.
    depth = path.count(_SLASH) + path.count(_BACKSLASH)
    return (-count, depth, path)
