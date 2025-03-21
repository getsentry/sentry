import datetime
import email.utils
import logging
from collections.abc import Mapping, Sequence
from dataclasses import asdict
from typing import Any
from urllib.parse import urlencode

import unidiff

from sentry.integrations.bitbucket.utils import BitbucketAPIPath
from sentry.integrations.source_code_management.commit_context import (
    CommitInfo,
    FileBlameInfo,
    SourceLineInfo,
)
from sentry.integrations.utils.commit_context import is_date_less_than_year
from sentry.shared_integrations.client.base import BaseApiClient
from sentry.shared_integrations.exceptions import ApiError

logger = logging.getLogger("sentry.integrations.bitbucket")


def _map_new_line_to_old(patched_file: unidiff.PatchedFile, lineno: int) -> int | None:
    """
    Given a unidiff Patch object (for a single file) and a lineno in the 'new' version,
    determine the corresponding line number in the 'old' version, or return None if
    the line is newly inserted by this patch.
    """

    # Sort hunks by the top of their "target" (new) range,
    # to process them in ascending order.
    sorted_hunks = sorted(patched_file, key=lambda h: h.target_start)

    # Track the "old" file line index and "new" file line index
    # where we are as we move down the file. They start at 1 by convention,
    # but we'll see if your patch library uses 0-based or 1-based.
    old_cursor = 1
    new_cursor = 1

    for hunk in sorted_hunks:
        # If this hunk starts *below* our current new_cursor,
        # first jump our cursors down to the start of the hunk.

        # Step 1: move old_cursor/new_cursor down to hunk.target_start
        # by counting them as context lines (1:1).
        # But if the hunk.target_start is *beyond* our lineno, we can break early:
        if new_cursor > lineno:
            # We've already passed the line we care about;
            # it was unaffected by any hunk. So just compute offset.
            return lineno + (old_cursor - new_cursor)

        # Move the cursors together in context (lines that are not changed)
        while new_cursor < hunk.target_start:
            # If we pass the lineno in that gap:
            if new_cursor == lineno:
                # That line is unaffected => same shift
                return lineno + (old_cursor - new_cursor)
            old_cursor += 1
            new_cursor += 1

        # Now new_cursor == hunk.target_start (or we've broken early).
        # We process lines *within* this hunk:

        for diff_line in hunk:
            if diff_line.is_added:
                # There's a new line but no old line
                if diff_line.target_line_no == lineno:
                    # Found our line; it's newly added
                    return None  # blame this patch
                # Advance new_cursor only
                new_cursor += 1

            elif diff_line.is_removed:
                # There's an old line but no new line
                # Advance old_cursor only
                old_cursor += 1

            else:
                # context line => line exists in both old and new
                # Check if new_cursor is our line
                if diff_line.target_line_no == lineno:
                    # Old line no is old_cursor
                    return old_cursor
                old_cursor += 1
                new_cursor += 1

    # If we finish all hunks and still haven't located lineno,
    # that means the line is below the last hunk. It's unaffected by
    # any changes in this patch, so we apply the final offset:

    if new_cursor <= lineno:
        # The line is below the last hunk
        return lineno + (old_cursor - new_cursor)

    # If somehow new_cursor > lineno, we would have returned earlier,
    # so typically we don't reach here, but just in case:
    return lineno + (old_cursor - new_cursor)


def _parse_commit(commit: Mapping[str, Any]) -> CommitInfo:
    id = commit["commit"]["hash"]

    committed_date = commit["commit"].get("date")
    if isinstance(committed_date, str):
        committed_date = datetime.datetime.fromisoformat(committed_date)

    message = commit["commit"].get("message")
    if isinstance(message, str):
        message = message.strip()

    author = commit["commit"]["author"].get("raw")
    if isinstance(author, str):
        author_name, author_email = email.utils.parseaddr(author)
    else:
        author_name = None
        author_email = None

    return CommitInfo(
        commitId=id,
        committedDate=committed_date,
        commitMessage=message,
        commitAuthorName=author_name,
        commitAuthorEmail=author_email,
    )


def _blame_file(
    client: BaseApiClient, file: SourceLineInfo, extra: Mapping[str, Any]
) -> FileBlameInfo | None:
    if file.lineno is None:
        logger.warning(
            "blame_file.no_lineno",
            extra={**extra, "file_path": file.path},
        )
        return None

    current_lineno = file.lineno
    logger.info("blame_file.start", extra={**extra, "current_lineno": current_lineno})

    filehistory_params = urlencode(
        {
            "fields": ",".join(
                [
                    "next",
                    "values.commit.author.*",
                    "values.commit.hash",
                    "values.commit.date",
                    "values.commit.message",
                ]
            ),
        }
    )
    filehistory_url = f"{BitbucketAPIPath.filehistory.format(repo=file.repo.name, sha=file.ref, path=file.path)}?{filehistory_params}"

    while filehistory_url:
        try:
            data = client.get(filehistory_url)
        except ApiError as e:
            if e.code in (401, 403, 404):
                logger.warning(
                    "blame_file.filehistory.api_error",
                    extra={
                        **extra,
                        "code": e.code,
                        "error_message": e.text,
                        "repo_name": file.repo.name,
                        "file_path": file.path,
                        "branch_name": file.ref,
                        "file_lineno": file.lineno,
                    },
                )
                return None
            raise

        for commit in data["values"]:
            commit_info = _parse_commit(commit)

            if not is_date_less_than_year(commit_info.committedDate):
                logger.warning(
                    "blame_file.commit_too_old",
                    extra={**extra, "commit_id": commit_info.commitId},
                )

                # We only want to blame commits from the last year
                return None

            diff_params = urlencode({"path": file.path})
            diff_url = f"{BitbucketAPIPath.repository_diff.format(repo=file.repo.name, spec=commit_info.commitId)}?{diff_params}"

            try:
                diff_response = client.get_cached(diff_url, raw_response=True)
            except ApiError as e:
                if e.code in (401, 403, 404):
                    logger.warning(
                        "blame_file.diff.api_error",
                        extra={
                            **extra,
                            "commit_id": commit_info.commitId,
                            "code": e.code,
                            "error_message": e.text,
                            "repo_name": file.repo.name,
                            "file_path": file.path,
                            "branch_name": file.ref,
                            "file_lineno": file.lineno,
                        },
                    )
                    return None
                raise

            patch_set = unidiff.PatchSet.from_string(diff_response.text)

            if len(patch_set) == 0:
                logger.warning(
                    "fetch_file_blames.no_patched_file",
                    extra={**extra, "file": file.path},
                )

                continue

            elif len(patch_set) > 1:
                raise ValueError(f"Expected 1 patched file, got {len(patch_set)}")

            old_lineno = _map_new_line_to_old(patch_set[0], current_lineno)
            if old_lineno is None:
                logger.info(
                    "blame_file.newly_inserted",
                    extra={
                        **extra,
                        "current_lineno": current_lineno,
                        "commit_id": commit_info.commitId,
                    },
                )

                # The line is newly inserted, so we can blame the commit
                return FileBlameInfo(
                    **asdict(file),
                    commit=commit_info,
                )

            # Otherwise, we need to blame the old line number
            logger.info(
                "blame_file.old_lineno",
                extra={
                    **extra,
                    "current_lineno": current_lineno,
                    "commit_id": commit_info.commitId,
                },
            )
            current_lineno = old_lineno

        # Get the next page of file history, if any
        filehistory_url = data.get("next")

    return None


def fetch_file_blames(
    client: BaseApiClient, files: Sequence[SourceLineInfo], extra: Mapping[str, Any]
) -> list[FileBlameInfo]:
    blames = []

    for file in files:
        blame = _blame_file(client, file, extra)
        if blame:
            blames.append(blame)
        else:
            logger.warning(
                "fetch_file_blames.no_blame_info",
                extra={**extra, "file_path": file.path, "file_lineno": file.lineno},
            )

    return blames
