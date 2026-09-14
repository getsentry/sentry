"""Approximate GitHub's languages API from a git tree.

GitHub exposes ``GET /repos/{repo}/languages`` returning byte counts per language,
and Sentry's platform detection is built directly on it. Origin has no equivalent,
so we derive the same shape from the recursive tree: map each blob's extension to a
Linguist language name and sum the blob sizes.

Keys deliberately match Linguist's names so the existing
``GITHUB_LANGUAGE_TO_SENTRY_PLATFORM`` registry -- and everything downstream of it
-- works unchanged.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

# Extension -> Linguist language name. Only languages Sentry can map to a platform
# are worth listing; anything unmapped is discarded by the caller anyway.
EXTENSION_TO_LANGUAGE: dict[str, str] = {
    ".py": "Python",
    ".pyi": "Python",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".mjs": "JavaScript",
    ".cjs": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".mts": "TypeScript",
    ".cts": "TypeScript",
    ".java": "Java",
    ".kt": "Kotlin",
    ".kts": "Kotlin",
    ".swift": "Swift",
    ".m": "Objective-C",
    ".mm": "Objective-C++",
    ".go": "Go",
    ".rb": "Ruby",
    ".rake": "Ruby",
    ".php": "PHP",
    ".rs": "Rust",
    ".cs": "C#",
    ".dart": "Dart",
    ".ex": "Elixir",
    ".exs": "Elixir",
    ".c": "C",
    ".h": "C",
    ".cc": "C++",
    ".cpp": "C++",
    ".cxx": "C++",
    ".hpp": "C++",
    ".hh": "C++",
    ".gd": "GDScript",
    ".ps1": "PowerShell",
    ".psm1": "PowerShell",
}

# Path segments Linguist treats as vendored or generated. Counting these badly skews
# detection -- a checked-in node_modules would drown out the actual application.
EXCLUDED_PATH_SEGMENTS = frozenset(
    {
        "node_modules",
        "vendor",
        "third_party",
        "thirdparty",
        "bower_components",
        "dist",
        "build",
        "out",
        "target",
        "bin",
        "obj",
        ".git",
        ".venv",
        "venv",
        "site-packages",
        "__pycache__",
        "migrations",
        "Pods",
        "Carthage",
    }
)

# Test code is real code, but weighting it equally tends to misidentify the primary
# platform of a repo whose tests dwarf its source.
EXCLUDED_TEST_SEGMENTS = frozenset({"test", "tests", "spec", "specs", "__tests__"})


def _is_excluded(path: str) -> bool:
    segments = path.split("/")
    # The final segment is the filename, not a directory.
    for segment in segments[:-1]:
        if segment in EXCLUDED_PATH_SEGMENTS or segment in EXCLUDED_TEST_SEGMENTS:
            return True
    return False


def _extension(path: str) -> str | None:
    filename = path.rsplit("/", 1)[-1]
    if "." not in filename:
        return None
    return "." + filename.rsplit(".", 1)[-1].lower()


def _size(entry: dict[str, Any]) -> int:
    """Blob size in bytes, tolerating a stringified number.

    Origin serialises 64-bit integers as JSON strings in places (``size`` on
    ``contents`` comes back as ``"2534"``). Tree entries use real ints today,
    but the pattern is common enough in that API that a bare ``+=`` would be a
    TypeError waiting to happen mid-detection.
    """
    try:
        return int(entry.get("size") or 0)
    except (TypeError, ValueError):
        return 0


def languages_from_tree(tree: list[dict[str, Any]]) -> dict[str, int]:
    """Byte counts per language, shaped like GitHub's languages API.

    ``tree`` is the entry list from Origin's ``git/trees/{ref}?recursive=1``. Blobs
    carry a ``size``; trees do not and are skipped.
    """
    totals: dict[str, int] = defaultdict(int)

    for entry in tree:
        if entry.get("type") != "blob":
            continue

        path = entry.get("path")
        if not path or _is_excluded(path):
            continue

        extension = _extension(path)
        if extension is None:
            continue

        language = EXTENSION_TO_LANGUAGE.get(extension)
        if language is None:
            continue

        totals[language] += _size(entry)

    # Drop languages that matched only empty files -- they carry no signal and would
    # register as a detected platform with zero weight.
    return {language: size for language, size in totals.items() if size > 0}
