from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from dataclasses import asdict
from datetime import timezone
from typing import Any, TypedDict
from urllib.parse import quote

import orjson
from isodate import parse_datetime

from sentry.integrations.gitlab.utils import (
    GitLabApiClientPath,
    GitLabRateLimitInfo,
    get_rate_limit_info_from_response,
)
from sentry.integrations.source_code_management.commit_context import (
    CommitInfo,
    FileBlameInfo,
    SourceLineInfo,
)
from sentry.shared_integrations.client.base import BaseApiClient
from sentry.shared_integrations.exceptions import ApiError, ApiRateLimitedError
from sentry.shared_integrations.response.sequence import SequenceApiResponse
from sentry.utils import metrics

logger = logging.getLogger("sentry.integrations.gitlab")


MINIMUM_REQUESTS = 100


class GitLabCommitResponse(TypedDict):
    id: str
    message: str | None
    committed_date: str | None
    author_name: str | None
    author_email: str | None
    committer_name: str | None
    committer_email: str | None


class GitLabFileBlameResponseItem(TypedDict):
    commit: GitLabCommitResponse
    lines: Sequence[str]


def fetch_file_blames(
    client: BaseApiClient, files: Sequence[SourceLineInfo], extra: Mapping[str, Any]
) -> list[FileBlameInfo]:
    blames = []

    for i, file in enumerate(files):
        try:
            commit, rate_limit_info = _fetch_file_blame(client, file, extra)
            if commit:
                blames.append(_create_file_blame_info(commit, file))
        except ApiError as e:
            _handle_file_blame_error(e, file, extra)
        else:
            # On first iteration, make sure we have enough requests left
            if (
                i == 0
                and len(files) > 1
                and rate_limit_info
                and rate_limit_info.remaining < (MINIMUM_REQUESTS - len(files))
            ):
                metrics.incr("integrations.gitlab.get_blame_for_files.rate_limit")
                logger.error(
                    "get_blame_for_files.rate_limit_too_low",
                    extra={
                        **extra,
                        "num_files": len(files),
                        "remaining_requests": rate_limit_info.remaining,
                        "total_requests": rate_limit_info.limit,
                        "next_window": rate_limit_info.next_window(),
                    },
                )
                raise ApiRateLimitedError("Approaching GitLab API rate limit")

    return blames


def _fetch_file_blame(
    client: BaseApiClient, file: SourceLineInfo, extra: Mapping[str, Any]
) -> tuple[CommitInfo | None, GitLabRateLimitInfo | None]:
    project_id = file.repo.config.get("project_id")

    # GitLab returns an invalid file path error if there are leading or trailing slashes
    encoded_path = quote(file.path.strip("/"), safe="")
    request_path = GitLabApiClientPath.blame.format(project=project_id, path=encoded_path)
    params = {"ref": file.ref, "range[start]": file.lineno, "range[end]": file.lineno}

    cache_key = client.get_cache_key(request_path, orjson.dumps(params).decode())
    response = client.check_cache(cache_key)
    if response:
        metrics.incr("integrations.gitlab.get_blame_for_files.got_cached")
        logger.info(
            "sentry.integrations.gitlab.get_blame_for_files.got_cached",
            extra=extra,
        )
    else:
        try:
            response = client.get(
                request_path,
                params=params,
            )
            client.set_cache(cache_key, response, 60)
        except ApiError:
            logger.exception(
                "fetch_file_blame_ApiError",
                extra={
                    "file_path": file.path,
                    "request_path": request_path,
                    "repo_org_id": file.repo.organization_id,
                    "repo_integration_id": file.repo.integration_id,
                },
            )
            raise

    if not isinstance(response, SequenceApiResponse):
        raise ApiError("Response is not in expected format", code=500)

    rate_limit_info = get_rate_limit_info_from_response(response)

    return _get_commit_info_from_blame_response(response, extra=extra), rate_limit_info


def _create_file_blame_info(commit: CommitInfo, file: SourceLineInfo) -> FileBlameInfo:
    return FileBlameInfo(
        **asdict(file),
        commit=commit,
    )


def _handle_file_blame_error(error: ApiError, file: SourceLineInfo, extra: Mapping[str, Any]):
    metrics.incr("integrations.gitlab.get_blame_for_files.api_error", tags={"status": error.code})

    # Ignore expected error codes
    if error.code in (401, 403, 404):
        logger.warning(
            "get_blame_for_files.api_error",
            extra={
                **extra,
                "code": error.code,
                "error_message": error.text,
                "repo_name": file.repo.name,
                "file_path": file.path,
                "branch_name": file.ref,
                "file_lineno": file.lineno,
            },
        )
        return

    raise error


def _get_commit_info_from_blame_response(
    response: Sequence[GitLabFileBlameResponseItem] | None, extra: Mapping[str, Any]
) -> CommitInfo | None:
    if response is None:
        return None

    commits = [_create_commit_from_blame(item.get("commit"), extra) for item in response]
    commits_with_required_info = [commit for commit in commits if commit is not None]

    if not commits_with_required_info:
        return None

    return max(commits_with_required_info, key=lambda commit: commit.committedDate)


def _create_commit_from_blame(
    commit: GitLabCommitResponse | None, extra: Mapping[str, Any]
) -> CommitInfo | None:
    if not commit:
        logger.warning("get_blame_for_files.no_commit_in_response", extra=extra)
        return None

    commit_id = commit.get("id")
    committed_date = commit.get("committed_date")

    if not commit_id:
        logger.warning(
            "get_blame_for_files.invalid_commit_response", extra={**extra, "missing_property": "id"}
        )
        return None

    if not committed_date:
        logger.warning(
            "get_blame_for_files.invalid_commit_response",
            extra={**extra, "commit_id": commit_id, "missing_property": "committed_date"},
        )
        return None

    try:
        return CommitInfo(
            commitId=commit_id,
            commitMessage=commit.get("message"),
            commitAuthorName=commit.get("author_name"),
            commitAuthorEmail=commit.get("author_email"),
            committedDate=parse_datetime(committed_date).replace(tzinfo=timezone.utc),
        )
    except Exception:
        logger.exception("get_blame_for_files.invalid_commit_response", extra=extra)
        return None
