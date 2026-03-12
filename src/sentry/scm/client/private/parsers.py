from datetime import datetime
from enum import Enum

import pydantic

from ..types import (
    SHA,
    BranchName,
    BuildConclusion,
    BuildStatus,
    FileStatus,
    PullRequestState,
    Reaction,
    ResourceId,
    ReviewSide,
    TreeEntryMode,
    TreeEntryType,
)


class Unset(Enum):
    """
    A single-valued Enum that plays well with the type checker to mark fields as absent when None is a valid value.
    """

    UNSET = "unset"


class Author(pydantic.BaseModel):
    id: ResourceId
    username: str


class Comment(pydantic.BaseModel):
    id: ResourceId
    body: str | None
    author: Author | None


class ReactionResult(pydantic.BaseModel):
    id: ResourceId
    content: Reaction
    author: Author | None


class PullRequestBranch(pydantic.BaseModel):
    sha: SHA | None
    ref: BranchName


class PullRequest(pydantic.BaseModel):
    id: ResourceId
    number: str
    title: str
    body: str | None
    state: PullRequestState
    merged: bool
    html_url: str
    head: PullRequestBranch
    base: PullRequestBranch


class GitRef(pydantic.BaseModel):
    ref: BranchName
    sha: SHA


class GitBlob(pydantic.BaseModel):
    sha: SHA


class FileContent(pydantic.BaseModel):
    path: str
    sha: SHA
    content: str  # base64-encoded
    encoding: str
    size: int


class CommitAuthor(pydantic.BaseModel):
    name: str
    email: str
    date: datetime | None


class CommitFile(pydantic.BaseModel):
    filename: str
    status: FileStatus
    patch: str | None


class Commit(pydantic.BaseModel):
    id: SHA
    message: str
    author: CommitAuthor | None
    files: list[CommitFile] | None


class TreeEntry(pydantic.BaseModel):
    path: str
    mode: TreeEntryMode
    type: TreeEntryType
    sha: SHA
    size: int | None


class InputTreeEntry(pydantic.BaseModel):
    path: str
    mode: TreeEntryMode
    type: TreeEntryType
    sha: SHA | None  # None for deletions


class GitTree(pydantic.BaseModel):
    sha: SHA
    tree: list[TreeEntry]
    truncated: bool


class GitCommitTree(pydantic.BaseModel):
    sha: SHA


class GitCommitObject(pydantic.BaseModel):
    sha: SHA
    tree: GitCommitTree
    message: str


class PullRequestFile(pydantic.BaseModel):
    filename: str
    status: FileStatus
    patch: str | None
    changes: int
    sha: SHA
    previous_filename: str | None


class PullRequestCommit(pydantic.BaseModel):
    sha: SHA
    message: str
    author: CommitAuthor | None


class ReviewCommentInput(pydantic.BaseModel):
    path: str
    body: str
    line: int | Unset = Unset.UNSET
    side: ReviewSide | Unset = Unset.UNSET
    start_line: int | Unset = Unset.UNSET
    start_side: ReviewSide | Unset = Unset.UNSET


class ReviewComment(pydantic.BaseModel):
    id: ResourceId
    html_url: str | None
    path: str
    body: str


class Review(pydantic.BaseModel):
    id: ResourceId
    html_url: str


class CheckRunOutput(pydantic.BaseModel):
    title: str
    summary: str
    text: str | Unset = Unset.UNSET


class CheckRun(pydantic.BaseModel):
    id: ResourceId
    name: str
    status: BuildStatus
    conclusion: BuildConclusion | None
    html_url: str
