from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, ValidationError, validator

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
