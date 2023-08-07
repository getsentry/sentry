from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Mapping, Optional, TypedDict

from sentry import nodestore

SPAN_SCHEMA_VERSION = 1


class SpanData(TypedDict):
    attributes: Mapping[str, object]
    id: str
    project_id: int
    tags: Mapping[str, str]
    trace_id: str


@dataclass(frozen=True)
class Span:
    attributes: Mapping[str, object]
    id: str
    project_id: int
    tags: Mapping[str, str]
    trace_id: str

    def to_dict(self) -> SpanData:
        return {
            "attributes": self.attributes,
            "id": self.id,
            "project_id": self.project_id,
            "tags": self.tags,
            "trace_id": self.trace_id,
        }

    @classmethod
    def from_dict(cls, data: SpanData) -> Span:
        return cls(
            data["attributes"],
            data["id"],
            data["project_id"],
            data["tags"],
            data["trace_id"],
        )

    @classmethod
    def key(cls, version: int, project_id: int, trace_id: str, span_id: str) -> str:
        identifier = hashlib.md5(f"{project_id}:{trace_id}:{span_id}".encode()).hexdigest()
        return f"s:{version}:{identifier}"

    def save(self) -> None:
        nodestore.backend.set(
            self.key(
                SPAN_SCHEMA_VERSION,
                self.project_id,
                self.trace_id,
                self.id,
            ),
            self.to_dict(),
        )

    @classmethod
    def fetch(cls, version: int, project_id: int, trace_id: str, span_id: str) -> Optional[Span]:
        if result := nodestore.backend.get(
            cls.key(
                version,
                project_id,
                trace_id,
                span_id,
            )
        ):
            return Span.from_dict(result)
        return None
