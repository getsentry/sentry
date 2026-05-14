from __future__ import annotations

from base64 import b64decode
from collections.abc import Sequence

from scm.errors import SCMError
from scm.types import GetDirectoryContentsProtocol, GetFileContentProtocol

from sentry.models.repository import Repository
from sentry.scm.cases._common import manager_for_repository

_REFERRER = "sentry.integrations.github.platform_detection"


def read_file(repository: Repository, path: str, ref: str | None = None) -> str | None:
    """Fetch a file's content from the repo. Returns None on any failure."""
    manager = manager_for_repository(repository, _REFERRER)
    if not isinstance(manager, GetFileContentProtocol):
        return None

    try:
        result = manager.get_file_content(path, ref or "")
    except SCMError:
        return None

    file = result["data"]
    try:
        return b64decode(file["content"]).decode("utf-8")
    except (KeyError, TypeError, UnicodeDecodeError, ValueError):
        return None


def list_root_entries(
    repository: Repository, ref: str | None = None
) -> tuple[set[str] | None, set[str] | None]:
    """Fetch root-level files and directory names. Returns (None, None) on failure."""
    manager = manager_for_repository(repository, _REFERRER)
    if not isinstance(manager, GetDirectoryContentsProtocol):
        return None, None

    try:
        paginated = manager.get_directory_contents("", ref=ref)
    except SCMError:
        return None, None

    entries: Sequence = paginated["data"]
    files = {e["path"] for e in entries if e.get("type") == "file"}
    dirs = {e["path"] for e in entries if e.get("type") == "directory"}
    return files, dirs
