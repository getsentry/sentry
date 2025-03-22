import logging
from collections.abc import Mapping, Sequence
from dataclasses import asdict
from datetime import datetime, timezone
from typing import Any

from sentry.integrations.bitbucket_server.utils import BitbucketServerAPIPath
from sentry.integrations.source_code_management.commit_context import (
    CommitInfo,
    FileBlameInfo,
    SourceLineInfo,
)
from sentry.shared_integrations.client.base import BaseApiClient
from sentry.shared_integrations.exceptions import ApiError

logger = logging.getLogger("sentry.integrations.bitbucket_server")


def _blame_file(
    client: BaseApiClient, file: SourceLineInfo, extra: Mapping[str, Any]
) -> FileBlameInfo | None:
    if file.lineno is None:
        logger.warning("blame_file.no_lineno", extra=extra)
        return None

    project = file.repo.config["project"]
    repo = file.repo.config["repo"]

    browse_url = BitbucketServerAPIPath.get_browse(
        project=project,
        repo=repo,
        path=file.path,
        sha=file.ref,
        blame=True,
        no_content=True,
    )

    try:
        data = client.get(browse_url)
    except ApiError as e:
        if e.code in (401, 403, 404):
            logger.warning(
                "blame_file.browse.api_error",
                extra={
                    **extra,
                    "code": e.code,
                    "error_message": e.text,
                },
            )
            return None
        raise

    for entry in data:
        start = entry["lineNumber"]
        span = entry["spannedLines"]
        end = start + span - 1  # inclusive range

        if start <= file.lineno <= end:
            commit_id = entry["commitId"]
            commited_date = datetime.fromtimestamp(
                entry["committerTimestamp"] / 1000.0, tz=timezone.utc
            )

            try:
                commit_data = client.get_cached(
                    BitbucketServerAPIPath.repository_commit.format(
                        project=project, repo=repo, commit=commit_id
                    ),
                )
            except ApiError as e:
                logger.warning(
                    "blame_file.commit.api_error",
                    extra={
                        **extra,
                        "code": e.code,
                        "error_message": e.text,
                        "commit_id": commit_id,
                    },
                )
                commit_message = None
            else:
                commit_message = commit_data.get("message")

            return FileBlameInfo(
                **asdict(file),
                commit=CommitInfo(
                    commitId=commit_id,
                    committedDate=commited_date,
                    commitMessage=commit_message,
                    commitAuthorName=entry["author"].get("name"),
                    commitAuthorEmail=entry["author"].get("emailAddress"),
                ),
            )

    return None


def fetch_file_blames(
    client: BaseApiClient, files: Sequence[SourceLineInfo], extra: Mapping[str, Any]
) -> list[FileBlameInfo]:
    blames = []
    for file in files:
        extra_file = {
            **extra,
            "repo_name": file.repo.name,
            "file_path": file.path,
            "branch_name": file.ref,
            "file_lineno": file.lineno,
        }

        blame = _blame_file(client, file, extra_file)
        if blame:
            blames.append(blame)
        else:
            logger.warning(
                "fetch_file_blames.no_blame",
                extra=extra_file,
            )
    return blames
