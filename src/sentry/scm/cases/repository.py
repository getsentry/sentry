from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import timezone
from typing import Any

from scm.types import (
    CompareCommitsProtocol,
    GetCommitProtocol,
    GetCommitsProtocol,
    GetPullRequestUrlProtocol,
)

from sentry import options
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.scm.cases._common import manager_for_repository
from sentry.scm.errors import SCMCapabilityUnsupported

MAX_COMPARE_COMMITS_OPTION_KEY = "github-app.fetch-commits.max-compare-commits"

_REFERRER = "sentry.integrations.github.repository"


def fetch_recent_commits(repository: Repository, end_sha: str) -> Sequence[Mapping[str, Any]]:
    manager = manager_for_repository(repository, _REFERRER)
    if not isinstance(manager, GetCommitsProtocol):
        raise SCMCapabilityUnsupported("get_commits", repository.provider)

    paginated = manager.get_commits(ref=end_sha, pagination={"per_page": 20})
    return _format_commits(manager, repository, paginated["data"])


def fetch_commits_for_compare_range(
    repository: Repository, start_sha: str, end_sha: str
) -> Sequence[Mapping[str, Any]]:
    manager = manager_for_repository(repository, _REFERRER)
    if not isinstance(manager, CompareCommitsProtocol):
        raise SCMCapabilityUnsupported("compare_commits", repository.provider)

    paginated = manager.compare_commits(start_sha, end_sha)
    commits = paginated["data"]
    max_compare_commits = options.get(MAX_COMPARE_COMMITS_OPTION_KEY)
    if max_compare_commits and len(commits) > max_compare_commits:
        commits = commits[-max_compare_commits:]
    return _format_commits(manager, repository, commits)


def compare_commits(
    repository: Repository, start_sha: str | None, end_sha: str
) -> Sequence[Mapping[str, Any]]:
    if start_sha is None:
        return fetch_recent_commits(repository, end_sha)
    return fetch_commits_for_compare_range(repository, start_sha, end_sha)


def pull_request_url(repository: Repository, pull_request: PullRequest) -> str:
    manager = manager_for_repository(repository, _REFERRER)
    if not isinstance(manager, GetPullRequestUrlProtocol):
        raise SCMCapabilityUnsupported("get_pull_request_url", repository.provider)
    return manager.get_pull_request_url(pull_request.key)


def _format_commits(
    manager: Any, repository: Repository, commits: Sequence[Mapping[str, Any]]
) -> list[Mapping[str, Any]]:
    out: list[Mapping[str, Any]] = []
    for commit in commits:
        author = commit.get("author") or {}
        author_date = author.get("date")
        timestamp = author_date.astimezone(timezone.utc) if author_date is not None else None
        out.append(
            {
                "id": commit["id"],
                "repository": repository.name,
                "author_email": author.get("email"),
                "author_name": author.get("name"),
                "message": commit["message"],
                "timestamp": timestamp,
                "patch_set": _get_patchset(manager, repository, commit["id"]),
            }
        )
    return out


def _get_patchset(manager: Any, repository: Repository, sha: str) -> Sequence[Mapping[str, Any]]:
    if not isinstance(manager, GetCommitProtocol):
        raise SCMCapabilityUnsupported("get_commit", repository.provider)
    result = manager.get_commit(sha)
    files = result["data"].get("files") or []
    return _transform_patchset(files)


def _transform_patchset(diff: Sequence[Mapping[str, Any]]) -> list[Mapping[str, Any]]:
    changes: list[Mapping[str, Any]] = []
    for change in diff:
        status = change.get("status")
        filename = change["filename"]
        if status == "modified":
            changes.append({"path": filename, "type": "M"})
        elif status == "added":
            changes.append({"path": filename, "type": "A"})
        elif status in ("removed", "deleted"):
            changes.append({"path": filename, "type": "D"})
        elif status == "renamed":
            previous = change.get("previous_filename")
            if previous:
                changes.append({"path": previous, "type": "D"})
            changes.append({"path": filename, "type": "A"})
    return changes
