from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, TypedDict

import unidiff


class FileChange(TypedDict):
    path: str
    type: Literal["A", "D", "M"]


def patch_to_file_changes(patch: str) -> list[FileChange]:
    patch_set = unidiff.PatchSet.from_string(patch)

    file_changes: list[FileChange] = []
    for patched_file in patch_set.added_files:
        file_changes.append({"path": patched_file.path, "type": "A"})

    for patched_file in patch_set.removed_files:
        file_changes.append({"path": patched_file.path, "type": "D"})

    for patched_file in patch_set.modified_files:
        file_changes.append({"path": patched_file.path, "type": "M"})

    return file_changes


@dataclass(frozen=True, kw_only=True, slots=True)
class FileModification:
    path: str
    lines_added: int
    lines_removed: int
    lines_modified: int


@dataclass(frozen=True, kw_only=True, slots=True)
class FileModifications:
    added: list[FileModification]
    removed: list[FileModification]
    modified: list[FileModification]


def patch_to_file_modifications(patch: str) -> FileModifications:
    patch_set = unidiff.PatchSet.from_string(patch)

    return FileModifications(
        added=_patched_files_to_file_modifications(patch_set.added_files),
        removed=_patched_files_to_file_modifications(patch_set.removed_files),
        modified=_patched_files_to_file_modifications(patch_set.modified_files),
    )


def _patched_files_to_file_modifications(
    patched_files: list[unidiff.PatchedFile],
) -> list[FileModification]:
    result: list[FileModification] = []

    for patched_file in patched_files:
        lines_added = 0
        lines_removed = 0
        lines_modified = 0

        for hunk in patched_file:
            lines = list(hunk)
            i = 0

            while i < len(lines):
                line = lines[i]
                if line.is_removed:
                    # Check if next line is an adjacent addition (potential modification)
                    if i + 1 < len(lines) and lines[i + 1].is_added:
                        lines_modified += 1
                        i += 2  # Skip the added line as well
                        continue
                    else:
                        lines_removed += 1
                elif line.is_added:
                    lines_added += 1
                i += 1

        result.append(
            FileModification(
                path=patched_file.path,
                lines_added=lines_added,
                lines_removed=lines_removed,
                lines_modified=lines_modified,
            )
        )

    return result
