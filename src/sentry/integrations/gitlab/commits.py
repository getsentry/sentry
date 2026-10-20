from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import datetime, timezone
from typing import Any, Literal

from dateutil.parser import parse as parse_date
from scm.types import CommitAuthor, CommitFile, CommitWithChanges, FileStatus


def _format_commit(
    *,
    id: str,
    author_email: str | None,
    author_name: str,
    message: str,
    timestamp: datetime,
    files: Sequence[CommitFile],
) -> CommitWithChanges:
    if message is None:
        raise ValueError("GitLab commit message must be complete")
    return CommitWithChanges(
        id=id,
        author=CommitAuthor(
            email=author_email or "",
            name=author_name,
            date=timestamp,
        ),
        message=message,
        additions=None,
        deletions=None,
        files=list(files),
    )


def format_api_commit(
    *,
    commit: Mapping[str, Any],
    patch_set: Sequence[CommitFile],
) -> CommitWithChanges:
    """Map a hydrated GitLab API commit to scm-platform's canonical shape."""
    return _format_commit(
        id=commit["id"],
        author_email=commit["author_email"],
        author_name=commit["author_name"],
        message=commit["message"],
        timestamp=parse_date(commit["created_at"]).astimezone(timezone.utc),
        files=patch_set,
    )


def format_sentry_commit(*, repository: str, commit: CommitWithChanges) -> dict[str, Any]:
    """Adapt a canonical SCM commit to the existing release persistence input."""
    author = commit["author"]
    return {
        "id": commit["id"],
        "repository": repository,
        "author_email": author["email"] or None if author is not None else None,
        "author_name": author["name"] if author is not None else "",
        "message": commit["message"],
        "timestamp": author["date"] if author is not None else None,
        "patch_set": [
            {
                "path": file["filename"],
                "type": _sentry_file_change_type(file["status"]),
            }
            for file in commit["files"] or ()
        ],
    }


def format_push_commit(*, commit: Mapping[str, Any]) -> CommitWithChanges:
    """Map a complete GitLab push payload commit to scm-platform's canonical shape."""
    files: list[CommitFile] = []
    change_fields: tuple[tuple[str, Literal["added", "modified", "removed"]], ...] = (
        ("added", "added"),
        ("removed", "removed"),
        ("modified", "modified"),
    )
    for field_name, status in change_fields:
        files.extend(_commit_file(path, status) for path in commit.get(field_name, ()))

    return _format_commit(
        id=commit["id"],
        author_email=commit["author"].get("email"),
        author_name=commit["author"]["name"],
        message=commit["message"],
        timestamp=parse_date(commit["timestamp"]).astimezone(timezone.utc),
        files=files,
    )


def transform_api_patch_set(
    changed_files: Sequence[Mapping[str, Any]],
) -> list[CommitFile]:
    file_changes: list[CommitFile] = []
    for changed_file in changed_files:
        if changed_file["new_file"]:
            file_changes.append(_commit_file(changed_file["new_path"], "added"))
        elif changed_file["deleted_file"]:
            file_changes.append(_commit_file(changed_file["old_path"], "removed"))
        elif changed_file["renamed_file"]:
            file_changes.append(_commit_file(changed_file["old_path"], "removed"))
            file_changes.append(_commit_file(changed_file["new_path"], "added"))
        else:
            file_changes.append(_commit_file(changed_file["new_path"], "modified"))

    return file_changes


def _commit_file(filename: str, status: Literal["added", "modified", "removed"]) -> CommitFile:
    return CommitFile(
        filename=filename,
        status=status,
        patch=None,
        additions=None,
        deletions=None,
        previous_filename=None,
    )


def _sentry_file_change_type(
    status: FileStatus,
) -> Literal["A", "D", "M"]:
    if status in ("added", "copied"):
        return "A"
    if status == "removed":
        return "D"
    return "M"
