from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from django.db import models

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.models.project import Project


class Dataset(models.TextChoices):
    CONVERSATION = "conversation", "Conversation"
    TRACE_SPANS = "trace_spans", "Trace spans"


class TelemetryClassifierOutputType(models.TextChoices):
    # Binary question. Returns the probability of a "yes" response.
    BINARY = "binary", "Binary"

    # Selects a named option. Returns the winner, option probabilities, and confidence.
    CHOICE = "choice", "Multiple choice"

    # Rates input against an ordered rubric. Returns a probability-weighted score.
    SCORE = "score", "Score"


class TelemetryClassifierStatus(models.TextChoices):
    DISABLED = "disabled", "Disabled"
    ENABLED = "enabled", "Enabled"


@dataclass(frozen=True)
class ExecutionContext:
    organization: Organization
    project: Project
    classifier_id: int
    # Full attribute name, including RESULT_ATTRIBUTE_PREFIX.
    result_attribute: str


@dataclass(frozen=True)
class Message:
    role: str
    content: str


@dataclass(frozen=True)
class InputSpec:
    """What a classifier model accepts as input."""

    # Messages with other roles are left out before truncation, so they don't use the allowance.
    roles: frozenset[str]
    max_chars: int


@dataclass(frozen=True)
class PreparedInput:
    """Bounded model input, oldest first."""

    messages: tuple[Message, ...]
    # Older content was cut to fit the model's input allowance.
    input_truncated: bool
    # Retrieval hit its bounds, so older source telemetry may be missing.
    source_truncated: bool

    @property
    def truncated(self) -> bool:
        return self.input_truncated or self.source_truncated


@dataclass(frozen=True)
class BinaryResult:
    # Probability of a "yes" answer, from 0 to 1. A low probability is a valid negative result.
    probability: float


# TODO: Add choice and score results once a classifier model returns them.
type ClassificationResult = BinaryResult


@dataclass(frozen=True)
class ClassifierModelContract:
    """Translates between our input and result types and one Seer classifier model's contract."""

    input_spec: InputSpec
    build_payload: Callable[[PreparedInput], dict[str, Any]]
    # Raises InvalidClassifierResponse for output that doesn't match the contract.
    parse_result: Callable[[Mapping[str, Any]], ClassificationResult]
    timeout_seconds: float


@dataclass(frozen=True)
class PrebuiltClassifier:
    key: str  # The exact Seer classifier model ID. Prompts live in Seer.
    dataset: Dataset
    output_type: TelemetryClassifierOutputType
    contract: ClassifierModelContract
    name: str
    description: str
    # Suggested result attribute name, without RESULT_ATTRIBUTE_PREFIX. Customers can change it.
    result_attribute: str


@dataclass(frozen=True)
class ResolvedDefinition:
    """An executable classifier definition, resolved from its persisted configuration."""

    # Seer classifier model ID.
    key: str
    dataset: Dataset
    output_type: TelemetryClassifierOutputType
    contract: ClassifierModelContract
