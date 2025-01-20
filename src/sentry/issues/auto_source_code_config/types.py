from typing import NamedTuple

from sentry.integrations.source_code_management.repo_trees import RepoAndBranch


class CodeMapping(NamedTuple):
    repo: RepoAndBranch
    stacktrace_root: str
    source_path: str
