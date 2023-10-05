import logging
from datetime import timezone
from typing import Dict, Optional, Sequence, TypedDict

from django.utils.datastructures import OrderedSet
from isodate import parse_datetime

from sentry.integrations.mixins.commit_context import CommitInfo, FileBlameInfo, SourceLineInfo
from sentry.shared_integrations.response.mapping import MappingApiResponse

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


FilePathMapping = Dict[str, Dict[str, OrderedSet]]


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
    response: MappingApiResponse,
    files: Sequence[SourceLineInfo],
    file_path_mapping: FilePathMapping,
) -> Sequence[FileBlameInfo]:
    """
    Using the file path mapping that generated the initial GraphQL query,
    this function extracts all commits from the response and maps each one
    back to the correct file.
    """
    logger_info = {}
    file_blames: Sequence[FileBlameInfo] = []
    for repo_index, (full_repo_name, ref) in enumerate(file_path_mapping.items()):
        repo = response.get("data", {}).get(f"repository{repo_index}")
        if not repo:
            logger.info(f"Repository {full_repo_name} does not exist in GitHub.", extra=logger_info)
            continue
        for ref_index, (ref_name, file_paths) in enumerate(ref.items()):
            ref = repo.get(f"ref{ref_index}")
            if not ref:
                logger.info(
                    f"Branch {ref_name} for repository {full_repo_name} does not exist in GitHub.",
                    extra=logger_info,
                )
                continue
            for file_path_index, file_path in enumerate(file_paths):
                blame = ref.get("target", {}).get(f"blame{file_path_index}")
                if not blame:
                    logger.info(
                        f"File {file_path} for branch {ref_name} for repository {full_repo_name} does not exist in GitHub.",
                        extra=logger_info,
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
                    logger.info(
                        f"No matching commit found for line {matching_file.lineno} in file {matching_file.path} in branch {matching_file.ref} in repository {full_repo_name} in GitHub.",
                        extra=logger_info,
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
):
    matching_file = [
        f for f in files if f.path == path and f.repo.name == repo_name and f.ref == ref
    ][0]
    matching_blame_range: GitHubFileBlameRange | None = next(
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

    commit = matching_blame_range.get("commit") or {}
    author = commit.get("author") or {}
    blame = FileBlameInfo(
        repo=matching_file.repo,
        lineno=matching_file.lineno,
        ref=matching_file.ref,
        path=matching_file.path,
        commit=CommitInfo(
            commitId=commit.get("oid"),
            commitAuthorName=author.get("name"),
            commitAuthorEmail=author.get("email"),
            commitMessage=commit.get("message"),
            committedDate=parse_datetime(commit.get("committedDate")).astimezone(timezone.utc),
        ),
    )

    return matching_file, blame


def _make_ref_query(ref: str, blame_queries: str, index: int):
    return f"""
        ref{index}: ref(qualifiedName: "{ref}") {{
            target {{
                ... on Commit {{{blame_queries}
                }}
            }}
        }}"""


def _make_blame_query(path: str, index: int):
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


def _make_repo_query(repo_name: str, repo_owner: str, ref_queries: str, index: int):
    return f"""
    repository{index}: repository(name: "{repo_name}", owner: "{repo_owner}") {{{ref_queries}
    }}"""
