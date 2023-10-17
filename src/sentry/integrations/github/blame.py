from __future__ import annotations

import logging
from dataclasses import asdict
from datetime import timezone
from typing import Dict, Optional, Sequence, TypedDict

from django.utils.datastructures import OrderedSet
from isodate import parse_datetime

from sentry.integrations.mixins.commit_context import CommitInfo, FileBlameInfo, SourceLineInfo

logger = logging.getLogger("sentry.integrations.github")


class GitHubAuthor(TypedDict):
    name: Optional[str]
    email: Optional[str]


class GitHubFileBlameCommit(TypedDict):
    oid: str
    author: Optional[GitHubAuthor]
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


FilePathMapping = Dict[str, Dict[str, OrderedSet]]
GitHubRepositoryResponse = Dict[str, GitHubRefResponse]


def generate_file_path_mapping(
    files: Sequence[SourceLineInfo],
) -> FilePathMapping:
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


def create_blame_query(file_path_mapping: FilePathMapping) -> str:
    """
    Create a GraphQL query to get blame information for a list of files
    """
    repo_queries = ""
    for repo_index, (full_repo_name, ref) in enumerate(file_path_mapping.items()):
        ref_queries = ""
        for ref_index, (ref_name, file_paths) in enumerate(ref.items()):
            blame_queries = "".join(
                [
                    _make_blame_query(file_path, file_path_index)
                    for file_path_index, file_path in enumerate(file_paths)
                ]
            )
            ref_queries += _make_ref_query(ref_name, blame_queries, ref_index)

        try:
            [repo_owner, repo_name] = full_repo_name.split("/", maxsplit=1)
        except ValueError:
            continue

        repo_queries += _make_repo_query(repo_name, repo_owner, ref_queries, repo_index)

    return f"""query {{{repo_queries}\n}}"""


def extract_commits_from_blame_response(
    response: GitHubGraphQlResponse,
    files: Sequence[SourceLineInfo],
    file_path_mapping: FilePathMapping,
    extra: dict[str, str | int | None],
) -> Sequence[FileBlameInfo]:
    """
    Using the file path mapping that generated the initial GraphQL query,
    this function extracts all commits from the response and maps each one
    back to the correct file.
    """
    file_blames: list[FileBlameInfo] = []
    for repo_index, (full_repo_name, ref_mapping) in enumerate(file_path_mapping.items()):
        repo_mapping: Optional[GitHubRepositoryResponse] = response.get("data", {}).get(
            f"repository{repo_index}"
        )
        if not repo_mapping:
            logger.error(
                "get_blame_for_files.extract_commits_from_blame.missing_repository",
                extra={**extra, "repo": full_repo_name},
            )
            continue
        for ref_index, (ref_name, file_paths) in enumerate(ref_mapping.items()):
            ref: Optional[GitHubRefResponse] = repo_mapping.get(f"ref{ref_index}")
            if not isinstance(ref, dict):
                logger.error(
                    "get_blame_for_files.extract_commits_from_blame.missing_branch",
                    extra={**extra, "repo": full_repo_name, "branch": ref_name},
                )
                continue
            for file_path_index, file_path in enumerate(file_paths):
                blame: Optional[GitHubBlameResponse] = ref.get("target", {}).get(
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
                matching_file, blame_info = _get_matching_file_and_blame(
                    files=files,
                    blame_ranges=blame.get("ranges", []),
                    path=file_path,
                    repo_name=full_repo_name,
                    ref=ref_name,
                )
                if not blame_info:
                    logger.error(
                        f"No matching commit found for line {matching_file.lineno} in file {matching_file.path} in branch {matching_file.ref} in repository {full_repo_name} in GitHub.",
                        extra=extra,
                    )
                    continue
                file_blames.append(blame_info)
    return file_blames


def _get_matching_file_and_blame(
    files: Sequence[SourceLineInfo],
    blame_ranges: Sequence[GitHubFileBlameRange],
    path: str,
    repo_name: str,
    ref: str,
) -> tuple[SourceLineInfo, Optional[FileBlameInfo]]:
    """
    Generates a FileBlameInfo object for the given file path, repo name, and ref.
    Combines matching objects from the initial file list and the blame range
    returned from the GraphQL response to create the FileBlameInfo.
    """
    matching_file = [
        f for f in files if f.path == path and f.repo.name == repo_name and f.ref == ref
    ][0]
    matching_blame_range = next(
        iter(
            [
                r
                for r in blame_ranges
                if r["startingLine"] <= matching_file.lineno <= r["endingLine"]
            ]
        ),
        None,
    )
    if not matching_blame_range:
        return matching_file, None

    commit: Optional[GitHubFileBlameCommit] = matching_blame_range.get("commit", None)
    if not commit:
        return matching_file, None
    committed_date = commit.get("committedDate")
    if not committed_date:
        return matching_file, None

    author = commit.get("author")
    blame = FileBlameInfo(
        **asdict(matching_file),
        commit=CommitInfo(
            commitId=commit.get("oid"),
            commitAuthorName=author.get("name") if author else None,
            commitAuthorEmail=author.get("email") if author else None,
            commitMessage=commit.get("message"),
            committedDate=parse_datetime(committed_date).astimezone(timezone.utc),
        ),
    )

    return matching_file, blame


def _make_ref_query(ref: str, blame_queries: str, index: int) -> str:
    return f"""
        ref{index}: ref(qualifiedName: "{ref}") {{
            target {{
                ... on Commit {{{blame_queries}
                }}
            }}
        }}"""


def _make_blame_query(path: str, index: int) -> str:
    return f"""
                    blame{index}: blame(path: "{path}") {{
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


def _make_repo_query(repo_name: str, repo_owner: str, ref_queries: str, index: int) -> str:
    return f"""
    repository{index}: repository(name: "{repo_name}", owner: "{repo_owner}") {{{ref_queries}
    }}"""
