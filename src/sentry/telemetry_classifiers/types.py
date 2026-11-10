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
    key: str  # Prebuilt classifier key used to identify it in Seer.
    dataset: Dataset
    name: str
    description: str
    result_attribute: str  # Attribute where classifier output materializes.
