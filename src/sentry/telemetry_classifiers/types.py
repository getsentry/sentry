from dataclasses import dataclass

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
    key: str  # The exact Seer one-shot ID. Prompts live in Seer.
    dataset: Dataset
    output_type: TelemetryClassifierOutputType
    name: str
    description: str
    # Suggested result attribute name, without RESULT_ATTRIBUTE_PREFIX. Customers can change it.
    result_attribute: str


@dataclass(frozen=True)
class ResolvedDefinition:
    """An executable classifier definition, resolved from its persisted configuration."""

    # Seer one-shot ID.
    key: str
    dataset: Dataset
    output_type: TelemetryClassifierOutputType
