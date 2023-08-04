from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Mapping, Optional, Sequence, TypedDict

from sentry import nodestore


class SpanData(TypedDict):
    id: str
    contexts: Mapping[str, object]
    project_id: int
    tags: Mapping[str, str]


@dataclass(frozen=True)
class Span:
    contexts: Mapping[str, object]
    id: str
    project_id: int
    tags: Mapping[str, str]

    def to_dict(self) -> SpanData:
        return {
            "contexts": self.contexts,
            "id": self.id,
            "project_id": self.project_id,
            "tags": self.tags,
        }

    @classmethod
    def from_dict(cls, data: SpanData) -> Span:
        return cls(
            data["contexts"],
            data["id"],
            data["project_id"],
            data["tags"],
        )

    @classmethod
    def build_storage_identifier(cls, span_id: str, project_id: int) -> str:
        identifier = hashlib.md5(f"{span_id}::{project_id}".encode()).hexdigest()
        return f"s:{identifier}"

    def save(self) -> None:
        nodestore.backend.set(
            self.build_storage_identifier(self.id, self.project_id), self.to_dict()
        )

    @classmethod
    def fetch(cls, span_id: str, project_id: int) -> Optional[Span]:
        results = nodestore.backend.get(cls.build_storage_identifier(span_id, project_id))
        if results:
            return Span.from_dict(results)
        return None

    @classmethod
    def fetch_multi(cls, ids: Sequence[str], project_id: int) -> Sequence[Optional[Span]]:
        ids = [cls.build_storage_identifier(id, project_id) for id in ids]
        results = nodestore.backend.get_multi(ids)
        return [Span.from_dict(results[id]) if results.get(id) else None for id in ids]
