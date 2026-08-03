from __future__ import annotations

import logging
from collections.abc import Sequence
from enum import StrEnum
from typing import Any

logger = logging.getLogger(__name__)


class PullRequestFileStatus(StrEnum):
    ADDED = "added"
    MODIFIED = "modified"
    REMOVED = "removed"
    RENAMED = "renamed"


_VALID_STATUSES = {s.value for s in PullRequestFileStatus}


def normalize_github_pr_files(files_data: Sequence[dict[str, Any]]) -> list[dict[str, Any]]:
    """Map raw GitHub ``/pulls/{n}/files`` JSON to churn-sorted per-file stats.

    Returns ``[{"path", "additions", "deletions", "status"}, ...]`` sorted by
    ``additions + deletions`` descending. Files with a missing/invalid filename or
    an unsupported status (e.g. GitHub's ``copied``/``changed``/``unchanged``) are
    dropped, mirroring the original preprod adapter's type-safety stance.
    """
    out: list[dict[str, Any]] = []
    for file_data in files_data:
        filename = file_data.get("filename")
        if not filename or not isinstance(filename, str):
            logger.warning(
                "pr_file_stats.parse.missing_filename",
                extra={"keys": list(file_data.keys()) if file_data else None},
            )
            continue
        status = file_data.get("status")
        if status not in _VALID_STATUSES:
            logger.warning(
                "pr_file_stats.parse.unrecognized_status",
                extra={"status": status, "file_name": filename},
            )
            continue
        out.append(
            {
                "path": filename,
                "additions": file_data.get("additions", 0),
                "deletions": file_data.get("deletions", 0),
                "status": status,
            }
        )
    out.sort(key=lambda f: f["additions"] + f["deletions"], reverse=True)
    return out
