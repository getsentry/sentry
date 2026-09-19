from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from sentry.integrations.cursor_origin.client import OriginCommit
from sentry.utils.dates import parse_timestamp

BRANCH_REF_PREFIX = "refs/heads/"


class OriginPayloadError(Exception):
    """Origin sent a verified payload that does not match its documented shape."""


def _require_str(value: Any, name: str) -> str:
    if not isinstance(value, str) or not value:
        raise OriginPayloadError(f"{name} must be a non-empty string")
    return value


@dataclass(frozen=True)
class PushedCommit:
    sha: str
    message: str
    author_name: str
    author_email: str
    authored_at: datetime | None

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
        authored_at = author.get("date")
        return cls(
            sha=sha,
            message=detail.get("message") or "",
            author_name=author.get("name") or "",
            author_email=author.get("email") or "",
            authored_at=parse_timestamp(authored_at) if authored_at else None,
        )


@dataclass(frozen=True)
class RefUpdate:
    ref: str
    before: str = ""
    after: str = ""
    created: bool = False
    deleted: bool = False
    head_commit: PushedCommit | None = None

    @property
    def is_branch(self) -> bool:
        return self.ref.startswith(BRANCH_REF_PREFIX)

    @classmethod
    def from_payload(cls, payload: Mapping[str, Any], name: str) -> RefUpdate:
        head_commit = payload.get("headCommit")
        return cls(
            ref=_require_str(payload.get("ref"), f"{name}.ref"),
            before=payload.get("before") or "",
            after=payload.get("after") or "",
            created=bool(payload.get("created")),
            deleted=bool(payload.get("deleted")),
            head_commit=(
                PushedCommit.from_head_commit(head_commit)
                if isinstance(head_commit, Mapping)
                else None
            ),
        )


@dataclass(frozen=True)
class PushEvent:
    repository_id: str
    ref_updates: list[RefUpdate] = field(default_factory=list)

    @classmethod
    def from_payload(cls, payload: Mapping[str, Any]) -> PushEvent:
        repository = payload.get("repository")
        if not isinstance(repository, Mapping):
            raise OriginPayloadError("repository must be an object")

        raw_updates = payload.get("refUpdates")
        if not isinstance(raw_updates, list):
            raise OriginPayloadError("refUpdates must be an array")

        updates = []
        for index, update in enumerate(raw_updates):
            if not isinstance(update, Mapping):
                raise OriginPayloadError(f"refUpdates[{index}] must be an object")
            updates.append(RefUpdate.from_payload(update, f"refUpdates[{index}]"))

        return cls(
            repository_id=_require_str(repository.get("id"), "repository.id"),
            ref_updates=updates,
        )
