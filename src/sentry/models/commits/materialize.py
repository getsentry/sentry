from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any, TypedDict

from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.commitfilechange import CommitFileChange
from sentry.models.repository import Repository
from sentry.plugins.providers.integration_repository import CommitPatchFile


class _CommitDefaults(TypedDict, total=False):
    author: CommitAuthor
    message: str
    date_added: datetime


@dataclass(frozen=True)
class MaterializedCommit:
    commit: Commit
    created: bool
    file_changes: Sequence[CommitFileChange]


def materialize_commit(
    *,
    organization_id: int,
    repository: Repository,
    author: CommitAuthor | None,
    data: Mapping[str, Any],
) -> MaterializedCommit:
    """Persist canonical commit data without owning the caller's transaction or side effects."""
    commit_defaults: _CommitDefaults = {}
    if author is not None:
        commit_defaults["author"] = author
    if "message" in data:
        commit_defaults["message"] = data["message"]
    if "timestamp" in data:
        commit_defaults["date_added"] = data["timestamp"]

    commit, created = Commit.objects.get_or_create(
        organization_id=organization_id,
        repository_id=repository.id,
        key=data["id"],
        defaults=commit_defaults,
    )
    if not created and any(
        getattr(commit, field_name) != value for field_name, value in commit_defaults.items()
    ):
        commit.update(**commit_defaults)

    patch_set: Sequence[CommitPatchFile] = data.get("patch_set") or ()
    changes_by_path: dict[str, CommitPatchFile] = {}
    for patched_file in patch_set:
        changes_by_path.setdefault(patched_file["path"], patched_file)

    existing_paths = set(
        CommitFileChange.objects.filter(
            commit_id=commit.id,
            filename__in=changes_by_path,
        ).values_list("filename", flat=True)
    )
    file_changes = [
        CommitFileChange(
            organization_id=organization_id,
            commit_id=commit.id,
            filename=path,
            type=patched_file["type"],
        )
        for path, patched_file in changes_by_path.items()
        if path not in existing_paths
    ]
    if file_changes:
        CommitFileChange.objects.bulk_create(file_changes, ignore_conflicts=True, batch_size=100)

    return MaterializedCommit(commit=commit, created=created, file_changes=file_changes)
