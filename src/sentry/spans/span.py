from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Mapping, Optional, TypedDict

from sentry import nodestore


class SpanData(TypedDict):
    id: str
    attributes: Mapping[str, object]
    project_id: int
    tags: Mapping[str, str]


@dataclass(frozen=True)
class Span:
    attributes: Mapping[str, object]
    id: str
    project_id: int
    tags: Mapping[str, str]

    def to_dict(self) -> SpanData:
        return {
            "attributes": self.attributes,
            "id": self.id,
            "project_id": self.project_id,
            "tags": self.tags,
        }

    @classmethod
    def from_dict(cls, data: SpanData) -> Span:
        return cls(
            data["attributes"],
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
