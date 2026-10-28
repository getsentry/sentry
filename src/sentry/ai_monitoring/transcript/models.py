"""Typed transcript records and their API serialization boundary."""

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any, Literal, NotRequired, TypedDict

# The API schema generator does not resolve PEP 695 aliases yet.
MessageRole = Literal["user", "assistant", "embedding", "evaluation", "memory"]


class ToolCallResponse(TypedDict):
    name: str
    nodeId: str
    hasError: bool
    duration: NotRequired[float]


class TranscriptMessageResponse(TypedDict):
    id: str
    role: MessageRole
    content: str
    timestamp: float
    nodeId: str
    traceId: NotRequired[str]
    projectId: NotRequired[str]
    userEmail: NotRequired[str]
    reasoning: NotRequired[str]
    agentName: NotRequired[str]
    modelName: NotRequired[str]
    duration: NotRequired[float]
    toolCalls: NotRequired[list[ToolCallResponse]]
    embeddingInput: NotRequired[str]
    embeddingTokens: NotRequired[float]
    embeddingHasError: NotRequired[bool]
    # Arbitrary provider JSON is intentionally open at the wire boundary.
    evaluation: NotRequired[dict[str, Any]]
    memory: NotRequired[dict[str, Any]]


@dataclass(frozen=True, slots=True)
class TranscriptSpan:
    span_id: str
    attributes: Mapping[str, object] = field(default_factory=dict, repr=False)
    start_timestamp: float = 0
    end_timestamp: float = 0
    parent_span_id: str | None = None
    has_errors: bool = False


@dataclass(frozen=True, slots=True)
class ToolCall:
    name: str
    span_id: str
    has_error: bool
    duration: float | None = None

    def to_api(self) -> ToolCallResponse:
        result = ToolCallResponse(name=self.name, nodeId=self.span_id, hasError=self.has_error)
        if self.duration is not None:
            result["duration"] = self.duration
        return result


@dataclass(frozen=True, slots=True)
class AssistantContent:
    content: str | None = field(default=None, repr=False)
    reasoning: str | None = field(default=None, repr=False)


@dataclass(slots=True)
class SpanGroups:
    generations: list[TranscriptSpan] = field(default_factory=list)
    tools: list[TranscriptSpan] = field(default_factory=list)
    embeddings: list[TranscriptSpan] = field(default_factory=list)
    evaluations: list[TranscriptSpan] = field(default_factory=list)
    memory: list[TranscriptSpan] = field(default_factory=list)


@dataclass(frozen=True, slots=True)
class TranscriptMessage:
    id: str
    role: MessageRole
    content: str = field(repr=False)
    timestamp: float
    span_id: str
    user_email: str | None = field(default=None, repr=False)
    reasoning: str | None = field(default=None, repr=False)
    agent_name: str | None = None
    model_name: str | None = None
    duration: float | None = None
    tool_calls: tuple[ToolCall, ...] | None = None
    embedding_input: str | None = field(default=None, repr=False)
    embedding_tokens: float | None = None
    embedding_has_error: bool | None = None
    evaluation: dict[str, object] | None = field(default=None, repr=False)
    memory: dict[str, object] | None = field(default=None, repr=False)

    def to_api(self) -> TranscriptMessageResponse:
        """Preserve absent-vs-null semantics without leaking the internal record shape."""
        result = TranscriptMessageResponse(
            id=self.id,
            role=self.role,
            content=self.content,
            timestamp=self.timestamp,
            nodeId=self.span_id,
        )
        if self.user_email is not None:
            result["userEmail"] = self.user_email
        if self.reasoning is not None:
            result["reasoning"] = self.reasoning
        if self.agent_name is not None:
            result["agentName"] = self.agent_name
        if self.model_name is not None:
            result["modelName"] = self.model_name
        if self.duration is not None:
            result["duration"] = self.duration
        if self.tool_calls is not None:
            result["toolCalls"] = [tool.to_api() for tool in self.tool_calls]
        if self.embedding_input is not None:
            result["embeddingInput"] = self.embedding_input
        if self.embedding_tokens is not None:
            result["embeddingTokens"] = self.embedding_tokens
        if self.embedding_has_error is not None:
            result["embeddingHasError"] = self.embedding_has_error
        if self.evaluation is not None:
            result["evaluation"] = self.evaluation
        if self.memory is not None:
            result["memory"] = self.memory
        return result
