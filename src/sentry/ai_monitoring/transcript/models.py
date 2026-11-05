"""Typed transcript records and their API serialization boundary."""

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Annotated, Any, Literal, NotRequired, TypedDict

# The API schema generator does not resolve PEP 695 aliases yet.
MessageRole = Literal["user", "assistant", "embedding", "evaluation", "memory"]

from sentry.apidocs.descriptions import ApiDescription


class ToolCallResponse(TypedDict):
    name: Annotated[str, ApiDescription("Name of the tool")]
    nodeId: Annotated[str, ApiDescription("ID of the tool call's span")]
    hasError: Annotated[bool, ApiDescription("Whether the tool call failed")]
    duration: NotRequired[Annotated[float, ApiDescription("Duration of the tool call in seconds")]]


class TranscriptMessageResponse(TypedDict):
    id: Annotated[str, ApiDescription("ID of the message")]
    role: Annotated[
        MessageRole,
        ApiDescription("Role of the message: user, assistant, embedding, evaluation or memory"),
    ]
    content: Annotated[str, ApiDescription("Content of the message")]
    timestamp: Annotated[
        float, ApiDescription("When the message was recorded, as a Unix timestamp in seconds")
    ]
    nodeId: Annotated[str, ApiDescription("ID of the span the message comes from")]
    traceId: NotRequired[Annotated[str, ApiDescription("ID of the trace the message comes from")]]
    projectId: NotRequired[
        Annotated[str, ApiDescription("ID of the project the message comes from")]
    ]
    userEmail: NotRequired[Annotated[str, ApiDescription("Email of the user who sent the message")]]
    reasoning: NotRequired[
        Annotated[str, ApiDescription("Reasoning the model recorded for the message")]
    ]
    agentName: NotRequired[
        Annotated[str, ApiDescription("Name of the agent that produced the message")]
    ]
    modelName: NotRequired[
        Annotated[str, ApiDescription("Name of the model that produced the message")]
    ]
    duration: NotRequired[
        Annotated[
            float, ApiDescription("Duration of the span that produced the message in seconds")
        ]
    ]
    toolCalls: NotRequired[
        Annotated[list[ToolCallResponse], ApiDescription("Tool calls the message made")]
    ]
    embeddingInput: NotRequired[Annotated[str, ApiDescription("Input of the embedding call")]]
    embeddingTokens: NotRequired[
        Annotated[float, ApiDescription("Number of tokens the embedding call used")]
    ]
    embeddingHasError: NotRequired[
        Annotated[bool, ApiDescription("Whether the embedding call failed")]
    ]
    # Arbitrary provider JSON is intentionally open at the wire boundary.
    evaluation: NotRequired[
        Annotated[dict[str, Any], ApiDescription("Evaluation result recorded by the provider")]
    ]
    memory: NotRequired[
        Annotated[dict[str, Any], ApiDescription("Memory operation recorded by the provider")]
    ]


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
