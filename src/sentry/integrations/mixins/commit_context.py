from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Protocol

from sentry.auth.exceptions import IdentityNotValid
from sentry.models.identity import Identity
from sentry.models.integrations.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.repository import Repository


@dataclass
class SourceLineInfo:
    lineno: int
    path: str
    ref: str
    repo: Repository
    code_mapping: RepositoryProjectPathConfig


@dataclass
class CommitInfo:
    commitId: str | None
    committedDate: datetime
    commitMessage: str | None
    commitAuthorName: str | None
    commitAuthorEmail: str | None


@dataclass
class FileBlameInfo(SourceLineInfo):
    commit: CommitInfo


class GetBlameForFile(Protocol):
    def get_blame_for_files(
        self, files: Sequence[SourceLineInfo], extra: Mapping[str, Any]
    ) -> list[FileBlameInfo]:
        ...


class GetClient(Protocol):
    def get_client(self) -> GetBlameForFile:
        ...


class CommitContextMixin(GetClient):
    # whether or not integration has the ability to search through Repositories
    # dynamically given a search query
    repo_search = False

    def get_blame_for_files(
        self, files: Sequence[SourceLineInfo], extra: Mapping[str, Any]
    ) -> list[FileBlameInfo]:
        """
        Calls the client's `get_blame_for_files` method to fetch blame for a list of files.

        files: list of FileBlameInfo objects
        """
        try:
            client = self.get_client()
        except Identity.DoesNotExist:
            return []
        try:
            response = client.get_blame_for_files(files, extra)
        except IdentityNotValid:
            return []

        return response

    def get_commit_context_all_frames(
        self, files: Sequence[SourceLineInfo], extra: Mapping[str, Any]
    ) -> list[FileBlameInfo]:
        """
        Given a list of source files and line numbers,returns the commit info for the most recent commit.
        """
        return self.get_blame_for_files(files, extra)
