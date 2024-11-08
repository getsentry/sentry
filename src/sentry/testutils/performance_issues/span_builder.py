from typing import Any

from sentry.spans.grouping.strategy.base import Span


class SpanBuilder:
    def __init__(self) -> None:
        self.trace_id = "a" * 32
        self.parent_span_id = "a" * 16
        self.span_id = "b" * 16
        self.start_timestamp: float = 0
        self.timestamp: float = 1
        self.same_process_as_parent = True
        self.op = "default"
        self.description: str | None = None
        self.fingerprint: list[str] | None = None
        self.tags: Any | None = None
        self.data: Any | None = None
        self.hash: str | None = None

    def with_op(self, op: str) -> "SpanBuilder":
        self.op = op
        return self

    def with_description(self, description: str | None) -> "SpanBuilder":
        self.description = description
        return self

    def with_span_id(self, span_id: str) -> "SpanBuilder":
        self.span_id = span_id
        return self

    def with_fingerprint(self, fingerprint: list[str]) -> "SpanBuilder":
        self.fingerprint = fingerprint
        return self

    def with_hash(self, hash: str) -> "SpanBuilder":
        self.hash = hash
        return self

    def with_data(self, data: dict) -> "SpanBuilder":
        self.data = data
        return self

    def build(self) -> Span:
        span: Span = {
            "trace_id": self.trace_id,
            "parent_span_id": self.parent_span_id,
            "span_id": self.span_id,
            "start_timestamp": self.start_timestamp,
            "timestamp": self.timestamp,
            "same_process_as_parent": self.same_process_as_parent,
            "op": self.op,
            "description": self.description,
            "fingerprint": self.fingerprint,
            "tags": self.tags,
            "data": self.data,
        }
        if self.hash is not None:
            span["hash"] = self.hash
        return span
