from __future__ import annotations

import logging
from collections.abc import Sequence
from enum import StrEnum
from typing import Any

from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.preprod.integration_utils import get_github_client

logger = logging.getLogger(__name__)

MAX_PR_FILES = 300


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
        if not isinstance(status, str) or status not in _VALID_STATUSES:
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


def _repo_name(repository: Repository) -> str:
    config_name = repository.config.get("name")
    if isinstance(config_name, str) and config_name:
        return config_name
    return repository.name


def fetch_pr_file_stats(
    organization: Organization, repository: Repository, pr_key: str
) -> list[dict[str, Any]]:
    """Fetch per-file diff stats for a pull request from GitHub.

    Returns churn-sorted normalized stats, or ``[]`` on any failure, a non-GitHub
    provider, or a missing client. Never raises into the caller.
    """
    repo_name = _repo_name(repository)
    try:
        client = get_github_client(organization, repo_name)
    except Exception:
        logger.exception("pr_file_stats.client_error", extra={"repo_id": repository.id})
        return []

    if client is None:
        return []

    try:
        # NOTE: get_pull_request_files returns only GitHub's first page (30 files).
        # Follow-up: push pagination into the client method for full coverage.
        raw_files = client.get_pull_request_files(repo_name, pr_key)
    except Exception:
        logger.exception(
            "pr_file_stats.fetch_error", extra={"repo_id": repository.id, "pr_key": pr_key}
        )
        return []

    if not raw_files:
        return []

    return normalize_github_pr_files(raw_files[:MAX_PR_FILES])
