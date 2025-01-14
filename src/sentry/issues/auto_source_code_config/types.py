from typing import NamedTuple


class RepoAndBranch(NamedTuple):
    name: str
    branch: str


class RepoTree(NamedTuple):
    repo: RepoAndBranch
    files: list[str]


class CodeMapping(NamedTuple):
    repo: RepoAndBranch
    stacktrace_root: str
    source_path: str
