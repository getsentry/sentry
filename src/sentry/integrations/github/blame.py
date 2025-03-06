from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from dataclasses import asdict
from datetime import timezone
from typing import Any, TypedDict

from django.utils.datastructures import OrderedSet
from isodate import parse_datetime

from sentry.integrations.source_code_management.commit_context import (
    CommitInfo,
    FileBlameInfo,
    SourceLineInfo,
)

logger = logging.getLogger("sentry.integrations.github")


class GitHubAuthor(TypedDict):
    name: str | None
    email: str | None


class GitHubFileBlameCommit(TypedDict):
    oid: str
    author: GitHubAuthor | None
    message: str
    committedDate: str


class GitHubFileBlameRange(TypedDict):
    commit: GitHubFileBlameCommit
    startingLine: int
    endingLine: int
    age: int


class GitHubBlameResponse(TypedDict):
    ranges: list[GitHubFileBlameRange]


class GitHubRefResponse(TypedDict):
    target: dict[str, GitHubBlameResponse]


class GitHubGraphQlResponse(TypedDict):
    data: dict[str, GitHubRepositoryResponse]
    errors: list[dict[str, str]]


FilePathMapping = dict[str, dict[str, OrderedSet]]
GitHubRepositoryResponse = dict[str, GitHubRefResponse]


def generate_file_path_mapping(files: Sequence[SourceLineInfo]) -> FilePathMapping:
    """
    Generates a nested mapping of repo -> ref -> file paths.
    This map is used to dedupe matching repos, refs, and file paths and only query
    for them once. This mapping is passed to `create_blame_query` and
    `extract_commits_from_blame_response`.
    """
    file_path_mapping: FilePathMapping = {}
    for file in files:
        repo = file_path_mapping.setdefault(file.repo.name, {})
        paths = repo.setdefault(file.ref, OrderedSet())
        paths.add(file.path)

    return file_path_mapping


def create_blame_query(
    file_path_mapping: FilePathMapping, extra: Mapping[str, Any]
) -> tuple[str, dict[str, str]]:
    """
    Create a GraphQL query to get blame information for a list of files
    """
    repo_queries = ""
    variable_names: list[str] = []
    variable_data: dict[str, str] = {}
    for repo_index, (full_repo_name, ref) in enumerate(file_path_mapping.items()):
        try:
            [repo_owner, repo_name] = full_repo_name.split("/", maxsplit=1)
        except ValueError:
            logger.exception(
                "get_blame_for_files.create_blame_query.invalid_repo_name",
                extra={**extra, "repo_name": full_repo_name},
            )
            continue

        var_repo_name = f"repo_name_{repo_index}"
        var_repo_owner = f"repo_owner_{repo_index}"
        variable_names.append(f"${var_repo_name}: String!")
        variable_names.append(f"${var_repo_owner}: String!")
        variable_data[var_repo_name] = repo_name
        variable_data[var_repo_owner] = repo_owner

        ref_queries = ""

        for ref_index, (ref_name, file_paths) in enumerate(ref.items()):
            var_ref = f"ref_{repo_index}_{ref_index}"
            variable_names.append(f"${var_ref}: String!")
            variable_data[var_ref] = ref_name

            blame_queries = ""
            for file_path_index, file_path in enumerate(file_paths):
                var_path = f"path_{repo_index}_{ref_index}_{file_path_index}"
                blame_queries += _make_blame_query(var_path, file_path_index)
                variable_names.append(f"${var_path}: String!")
                variable_data[var_path] = file_path.strip("/")
            ref_queries += _make_ref_query(var_ref, blame_queries, ref_index)

        repo_queries += _make_repo_query(
            var_repo_name=var_repo_name,
            var_repo_owner=var_repo_owner,
            ref_queries=ref_queries,
            index=repo_index,
        )

    return f"""query ({", ".join(variable_names)}) {{{repo_queries}\n}}""", variable_data


def extract_commits_from_blame_response(
    response: GitHubGraphQlResponse,
    files: Sequence[SourceLineInfo],
    file_path_mapping: FilePathMapping,
    extra: dict[str, str | int | None],
) -> list[FileBlameInfo]:
    """
    Using the file path mapping that generated the initial GraphQL query,
    this function extracts all commits from the response and maps each one
    back to the correct file.
    """
    file_blames: list[FileBlameInfo] = []
    for repo_index, (full_repo_name, ref_mapping) in enumerate(file_path_mapping.items()):
        repo_mapping: GitHubRepositoryResponse | None = response.get("data", {}).get(
            f"repository{repo_index}"
        )
        if not repo_mapping:
            logger.warning(
                "get_blame_for_files.extract_commits_from_blame.missing_repository",
                extra={**extra, "repo": full_repo_name},
            )
            continue
        for ref_index, (ref_name, file_paths) in enumerate(ref_mapping.items()):
            ref: GitHubRefResponse | None = repo_mapping.get(f"ref{ref_index}")
            if not isinstance(ref, dict):
                logger.warning(
                    "get_blame_for_files.extract_commits_from_blame.missing_branch",
                    extra={**extra, "repo": full_repo_name, "branch": ref_name},
                )
                continue
            for file_path_index, file_path in enumerate(file_paths):
                blame: GitHubBlameResponse | None = ref.get("target", {}).get(
                    f"blame{file_path_index}"
                )
                if not blame:
                    logger.error(
                        "get_blame_for_files.extract_commits_from_blame.missing_file_blame",
                        extra={
                            **extra,
                            "repo": full_repo_name,
                            "branch": ref_name,
                            "file_path": file_path,
                        },
                    )
                    continue
                matching_files = [
                    f
                    for f in files
                    if f.path == file_path and f.repo.name == full_repo_name and f.ref == ref_name
                ]
                for file in matching_files:
                    log_info = {
                        **extra,
                        "file_lineno": file.lineno,
                        "file_path": file.path,
                        "branch_name": file.ref,
                        "repo_name": full_repo_name,
                    }
                    blame_info = _get_matching_file_blame(
                        file=file,
                        blame_ranges=blame.get("ranges", []),
                        extra=log_info,
                    )
                    if not blame_info:
                        continue
                    file_blames.append(blame_info)
    return file_blames


def _get_matching_file_blame(
    file: SourceLineInfo,
    blame_ranges: Sequence[GitHubFileBlameRange],
    extra: dict[str, str | int | None],
) -> FileBlameInfo | None:
    """
    Generates a FileBlameInfo object for the given file. Searches the given blame range
    and validates that the commit is valid before creating the FileBlameInfo object.
    """
    if file.lineno is None:
        return None

    matching_blame_range = next(
        iter([r for r in blame_ranges if r["startingLine"] <= file.lineno <= r["endingLine"]]),
        None,
    )
    if not matching_blame_range:
        logger.warning(
            "get_blame_for_files.extract_commits_from_blame.no_matching_blame_range",
            extra=extra,
        )
        return None

    commit: GitHubFileBlameCommit | None = matching_blame_range.get("commit", None)
    if not commit:
        logger.error(
            "get_blame_for_files.extract_commits_from_blame.no_commit_data",
            extra=extra,
        )
        return None

    committed_date_str = commit.get("committedDate")
    commit_id = commit.get("oid")

    if not commit_id:
        logger.error(
            "get_blame_for_files.extract_commits_from_blame.invalid_commit_response",
            extra={
                **extra,
                "reason": "Missing property oid",
            },
        )
        return None
    if not committed_date_str:
        logger.error(
            "get_blame_for_files.extract_commits_from_blame.invalid_commit_response",
            extra={
                **extra,
                "commit_id": commit_id,
                "reason": "Missing property committedDate",
            },
        )
        return None

    try:
        committed_date = parse_datetime(committed_date_str).astimezone(timezone.utc)
    except Exception:
        logger.exception(
            "get_blame_for_files.extract_commits_from_blame.invalid_commit_response",
            extra={
                **extra,
                "commit_id": commit_id,
                "committed_date": committed_date_str,
                "reason": "Failed to convert committed date to datetime.",
            },
        )
        return None

    author = commit.get("author")
    blame = FileBlameInfo(
        **asdict(file),
        commit=CommitInfo(
            commitId=commit_id,
            commitAuthorName=author.get("name") if author else None,
            commitAuthorEmail=author.get("email") if author else None,
            commitMessage=commit.get("message"),
            committedDate=committed_date,
        ),
    )

    return blame


def _make_ref_query(var_ref: str, blame_queries: str, index: int) -> str:
    return f"""
        ref{index}: ref(qualifiedName: ${var_ref}) {{
            target {{
                ... on Commit {{{blame_queries}
                }}
            }}
        }}"""


def _make_blame_query(var_repo: str, blame_index: int) -> str:
    return f"""
                    blame{blame_index}: blame(path: ${var_repo}) {{
                        ranges {{
                            commit {{
                                oid
                                author {{
                                    name
                                    email
                                }}
                                message
                                committedDate
                            }}
                            startingLine
                            endingLine
                            age
                        }}
                    }}"""


def _make_repo_query(var_repo_name: str, var_repo_owner: str, ref_queries: str, index: int) -> str:
    return f"""
    repository{index}: repository(name: ${var_repo_name}, owner: ${var_repo_owner}) {{{ref_queries}
    }}"""
