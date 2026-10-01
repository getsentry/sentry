from __future__ import annotations

import posixpath
import re
from urllib.parse import unquote

WINDOWS_ABSOLUTE_PATH_RE = re.compile(r"^[A-Za-z]:/")


def normalize_scm_path(path: str) -> str | None:
    """Canonicalize a path without turning encoded URL delimiters into syntax."""
    normalized_separators = path.replace("\\", "/")
    if "\x00" in normalized_separators:
        return None

    encoded_candidate = normalized_separators
    parent_segment_count = encoded_candidate.split("/").count("..")
    seen = set()
    while encoded_candidate not in seen:
        seen.add(encoded_candidate)
        decoded_candidate = unquote(encoded_candidate).replace("\\", "/")
        if decoded_candidate == encoded_candidate:
            break
        if "\x00" in decoded_candidate:
            return None
        decoded_parent_segment_count = decoded_candidate.split("/").count("..")
        if decoded_parent_segment_count > parent_segment_count:
            return None
        parent_segment_count = decoded_parent_segment_count
        encoded_candidate = decoded_candidate

    normalized_path = posixpath.normpath(normalized_separators)
    if is_windows_absolute_scm_path(normalized_separators) and not is_windows_absolute_scm_path(
        normalized_path
    ):
        return None
    return "" if normalized_path == "." else normalized_path


def is_windows_absolute_scm_path(path: str) -> bool:
    """Return whether a slash-normalized path starts with a Windows drive."""
    return WINDOWS_ABSOLUTE_PATH_RE.match(path) is not None


def is_absolute_scm_path(path: str) -> bool:
    """Return whether a slash-normalized path is POSIX or Windows absolute."""
    return path.startswith("/") or is_windows_absolute_scm_path(path)
