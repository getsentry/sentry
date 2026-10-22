"""Approximate GitHub's languages API from an Origin git tree.

Origin has no languages endpoint, so we derive GitHub's ``{language: bytes}`` shape
from the recursive tree: map each blob's extension to a Linguist language name and sum
the blob sizes. Keys match Linguist's names so ``GITHUB_LANGUAGE_TO_SENTRY_PLATFORM``
and everything downstream of it work unchanged.

Vendored-path exclusions come from the detection module, so Origin and GitHub
ignore the same directories.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Mapping, Sequence
from typing import Any

from sentry.integrations.source_code_management.repo_trees import segments_are_ignored

# Git mode for a symlink. Symlinks are blobs whose content is the target path, so an
# unfiltered "client.py" symlink would contribute its target's length as Python.
_SYMLINK_MODE = "120000"

# Extension -> Linguist language name, limited to the languages
# GITHUB_LANGUAGE_TO_SENTRY_PLATFORM maps; anything else is discarded downstream.
#
# Deliberately unmapped: ``.razor``/``.cshtml``, which Linguist calls "HTML+Razor" —
# not a key the platform registry knows, and Blazor repos are already counted through
# their ``.cs`` files.
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
    ".gemspec": "Ruby",
    ".php": "PHP",
    ".rs": "Rust",
    ".cs": "C#",
    ".dart": "Dart",
    ".ex": "Elixir",
    ".exs": "Elixir",
    ".c": "C",
    # Linguist disambiguates .h by content. "C" is the safe guess: C and C++ share the
    # native platform, while Objective-C would send a plain C repo to apple-ios.
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


def _language(path: str) -> str | None:
    """Linguist language for a blob path, or None if excluded or unmapped."""
    *directories, filename = path.split("/")
    if segments_are_ignored(directories):
        return None
    _, dot, extension = filename.rpartition(".")
    if not dot:
        return None
    return EXTENSION_TO_LANGUAGE.get(f".{extension.lower()}")


def languages_from_tree(tree: Sequence[Mapping[str, Any]]) -> dict[str, int]:
    """Byte counts per language, shaped like GitHub's languages API.

    ``tree`` is the entry list from Origin's ``git/trees/{sha}?recursive=true``.
    """
    totals: dict[str, int] = defaultdict(int)

    for entry in tree:
        if entry["type"] != "blob" or entry["mode"] == _SYMLINK_MODE:
            continue

        language = _language(entry["path"])
        if language is None:
            continue

        # Documented as set for every blob; one missing would raise rather than skip.
        size = entry.get("size")
        if size is None:
            continue

        totals[language] += size

    # A language totalling zero bytes would still claim one of the caller's platform
    # slots, with no evidence behind it.
    return {language: total for language, total in totals.items() if total > 0}
