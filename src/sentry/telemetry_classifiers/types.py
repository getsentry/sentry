from dataclasses import dataclass
from datetime import datetime
from typing import Any

from django.db import models


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
class PrebuiltClassifier:
    key: str  # The exact Seer classifier model ID. Prompts live in Seer.
    dataset: Dataset
    output_type: TelemetryClassifierOutputType
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


# A JSON-serializable telemetry item to classify. Datasets decide what it contains.
type Event = dict[str, Any]


@dataclass(frozen=True)
class PreparedInput:
    """Events to classify, oldest first."""

    events: tuple[Event, ...]
    # Older events were left out to fit MAX_INPUT_CHARS.
    truncated: bool


@dataclass(frozen=True)
class TelemetryInput:
    """One entity's telemetry, loaded for classification."""

    # Oldest first.
    events: list[Event]
    # Loading hit its limits, so some telemetry is missing or shortened.
    truncated: bool
    # Where the result is written in EAP, taken from the newest span.
    trace_id: str
    timestamp: datetime
    client_sample_rate: float
    conversation_id: str | None
