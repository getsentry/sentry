from __future__ import annotations

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
