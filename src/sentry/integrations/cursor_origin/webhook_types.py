from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, ValidationError, root_validator, validator

from sentry.integrations.cursor_origin.client import OriginCommit

BRANCH_REF_PREFIX = "refs/heads/"


class OriginPayloadError(Exception):
    """Origin sent a verified payload that does not match its documented shape."""


class OriginModel(BaseModel):
    class Config:
        allow_mutation = False
        allow_population_by_field_name = True


class PushedCommit(OriginModel):
    sha: str = Field(min_length=1)
    message: str = ""
    author_name: str = ""
    author_email: str = ""
    authored_at: datetime | None = None

    @validator("authored_at", pre=True)
    def _absent_date(cls, value: Any) -> Any:
        """Origin sends an empty string for an absent scalar."""
        return value or None

    @classmethod
    def from_head_commit(cls, head_commit: Mapping[str, Any]) -> PushedCommit | None:
        sha = head_commit.get("sha")
        if not isinstance(sha, str) or not sha:
            return None
        return cls._build(sha, head_commit)

    @classmethod
    def from_api_commit(cls, commit: OriginCommit) -> PushedCommit:
        return cls._build(commit["sha"], commit["commit"])

    @classmethod
    def _build(cls, sha: str, detail: Mapping[str, Any]) -> PushedCommit:
        author = detail.get("author") or {}
        return cls(
            sha=sha,
            message=detail.get("message") or "",
            author_name=author.get("name") or "",
            author_email=author.get("email") or "",
            authored_at=author.get("date"),
        )


class RefUpdate(OriginModel):
    ref: str = Field(min_length=1)
    before: str = ""
    after: str = ""
    created: bool = False
    deleted: bool = False
    head_commit: PushedCommit | None = Field(default=None, alias="headCommit")

    @property
    def is_branch(self) -> bool:
        return self.ref.startswith(BRANCH_REF_PREFIX)

    @validator("head_commit", pre=True)
    def _read_head_commit(cls, value: Any) -> Any:
        """Origin documents the tip as best-effort, so absent or partial is not an error."""
        if not isinstance(value, Mapping):
            return None
        return PushedCommit.from_head_commit(value)


class Repository(OriginModel):
    id: str = Field(min_length=1)


class PushEvent(OriginModel):
    repository: Repository
    ref_updates: list[RefUpdate] = Field(default_factory=list, alias="refUpdates")

    @property
    def repository_id(self) -> str:
        return self.repository.id

    @classmethod
    def from_payload(cls, payload: Mapping[str, Any]) -> PushEvent:
        try:
            return cls.parse_obj(payload)
        except ValidationError as e:
            raise OriginPayloadError(str(e)) from e


class RepositorySnapshot(OriginModel):
    id: str = Field(min_length=1)
    full_name: str = Field(min_length=1, alias="fullName")
    default_branch: str = Field(min_length=1, alias="defaultBranch")


class RepositoryMetadataEvent(OriginModel):
    repository: RepositorySnapshot

    @classmethod
    def from_payload(cls, payload: Mapping[str, Any]) -> RepositoryMetadataEvent:
        try:
            return cls.parse_obj(payload)
        except ValidationError as e:
            raise OriginPayloadError(str(e)) from e


class PullRequestHead(OriginModel):
    sha: str = Field(min_length=1)


class PullRequestUser(OriginModel):
    email: str = Field(min_length=1)
    display_name: str = Field(default="", alias="displayName")


class PullRequestApp(OriginModel):
    id: str = Field(min_length=1)
    display_name: str = Field(default="", alias="displayName")


class PullRequestServiceAccount(OriginModel):
    id: str = Field(min_length=1)


class PullRequestAuthor(OriginModel):
    """Exactly one of a user, an app or a service account."""

    user: PullRequestUser | None = None
    app: PullRequestApp | None = None
    service_account: PullRequestServiceAccount | None = Field(default=None, alias="serviceAccount")

    @root_validator(skip_on_failure=True)
    def _one_actor(cls, values: dict[str, Any]) -> dict[str, Any]:
        if sum(values[key] is not None for key in ("user", "app", "service_account")) != 1:
            raise ValueError("expected exactly one of user, app or serviceAccount")
        return values

    def email_and_name(self) -> tuple[str, str]:
        """Only a user has an email, so like GitHub, an app or service account gets a `@localhost` one."""
        if self.user is not None:
            return self.user.email, self.user.display_name
        if self.app is not None:
            return f"{self.app.id}@localhost", self.app.display_name or self.app.id
        assert self.service_account is not None
        return f"{self.service_account.id}@localhost", self.service_account.id


class PullRequest(OriginModel):
    """Origin's own id is not kept: it is a prefixed string, and
    `PullRequest.external_id` is an integer column."""

    number: str = Field(min_length=1)
    title: str
    body: str
    state: Literal["open", "closed"]
    draft: bool
    merged: bool
    head: PullRequestHead
    merge_commit_sha: str = Field(alias="mergeCommitSha")
    author: PullRequestAuthor
    created_at: datetime | None = Field(..., alias="createdAt")
    updated_at: datetime | None = Field(..., alias="updatedAt")
    closed_at: datetime | None = Field(..., alias="closedAt")
    merged_at: datetime | None = Field(..., alias="mergedAt")

    @validator("created_at", "updated_at", "closed_at", "merged_at", pre=True)
    def _absent_date(cls, value: Any) -> Any:
        """Origin sends an empty string for an unset date."""
        return value or None


class PullRequestEvent(OriginModel):
    repository: Repository
    pull_request: PullRequest = Field(alias="pullRequest")

    @property
    def repository_id(self) -> str:
        return self.repository.id

    @classmethod
    def from_payload(cls, payload: Mapping[str, Any]) -> PullRequestEvent:
        try:
            return cls.parse_obj(payload)
        except ValidationError as e:
            raise OriginPayloadError(str(e)) from e
