"""Domain values for LLM prompt-cache usage detection."""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum

DETECTION_WINDOW_DAYS = 7

# Smaller prompts do not produce material savings, even when a provider can cache them.
MIN_CACHEABLE_PREFIX_TOKENS = 4_096
MIN_CALLS_FOR_CONFIDENCE = 200
MIN_SAMPLED_CALLS = 50
NOT_CACHING_MAX_HIT_RATE = 0.05
THRASH_MAX_HIT_RATE = 0.30
THRASH_MIN_CREATION_INPUT_FRACTION = 0.3

# These integrations omit cache-token attributes when their values are zero.
POSITIVE_ONLY_CACHE_REPORTING_MODEL_MARKERS = ("gemini", "gpt")
POSITIVE_ONLY_CACHE_REPORTING_MODEL_PATTERN = re.compile(r"(?:^|[/:])o\d")


@dataclass(frozen=True)
class DetectionWindow:
    """Time range used by every query in one detection run."""

    start: datetime
    end: datetime

    @classmethod
    def ending_now(cls) -> DetectionWindow:
        end = datetime.now(UTC)
        return cls(start=end - timedelta(days=DETECTION_WINDOW_DAYS), end=end)


class AgentLabelSource(StrEnum):
    """Span attribute used to label a call site."""

    AGENT_NAME = "gen_ai.agent.name"
    OPERATION_NAME = "gen_ai.operation.name"


class CacheOutcome(StrEnum):
    HEALTHY = "healthy"
    NOT_CACHING = "not_caching"
    THRASH = "thrash"
    INELIGIBLE = "ineligible"


FLAGGED_OUTCOMES = frozenset({CacheOutcome.NOT_CACHING, CacheOutcome.THRASH})


class OutcomeReason(StrEnum):
    SMALL_PROMPTS = "small_prompts"
    LOW_VOLUME = "low_volume"
    FEW_STORED_SPANS = "few_stored_spans"
    CACHE_ACTIVITY = "cache_activity"
    ZERO_CACHE_TOKENS = "zero_cache_tokens"
    POSITIVE_ONLY_REPORTER = "positive_only_reporter"


@dataclass(frozen=True)
class Classification:
    outcome: CacheOutcome
    reason: OutcomeReason


@dataclass(frozen=True)
class CallSiteStats:
    """Aggregates for one agent label, span name, and model.

    Call count is extrapolated. Sampled call count records stored spans behind
    token sums.
    """

    agent_label: str
    agent_label_source: AgentLabelSource
    span_name: str
    model: str
    call_count: int
    sampled_call_count: int
    sum_input_tokens: float
    sum_cache_read_tokens: float
    sum_cache_creation_tokens: float
    avg_input_tokens: float

    @property
    def group_key(self) -> tuple[str, str, str, str]:
        return (self.agent_label_source.value, self.agent_label, self.span_name, self.model)

    @property
    def hit_rate(self) -> float:
        if self.sum_input_tokens <= 0:
            return 0.0
        return self.sum_cache_read_tokens / self.sum_input_tokens

    @property
    def write_read_ratio(self) -> float | None:
        if self.sum_cache_read_tokens <= 0:
            return None
        return self.sum_cache_creation_tokens / self.sum_cache_read_tokens

    @property
    def uncached_tokens(self) -> float:
        """Input tokens neither read from nor written to cache."""
        return max(
            self.sum_input_tokens - self.sum_cache_read_tokens - self.sum_cache_creation_tokens,
            0.0,
        )

    @property
    def cache_exceeds_input(self) -> bool:
        """Whether cache token totals exceed input beyond rounding error."""
        cache_tokens = self.sum_cache_read_tokens + self.sum_cache_creation_tokens
        return cache_tokens > self.sum_input_tokens and not math.isclose(
            cache_tokens, self.sum_input_tokens
        )

    @property
    def unrecouped_cache_write_tokens(self) -> float:
        return max(self.sum_cache_creation_tokens - self.sum_cache_read_tokens, 0.0)

    @property
    def has_cache_activity(self) -> bool:
        return self.sum_cache_read_tokens > 0 or self.sum_cache_creation_tokens > 0


@dataclass(frozen=True)
class CacheFinding:
    classification: Classification
    stats: CallSiteStats

    @property
    def outcome(self) -> CacheOutcome:
        return self.classification.outcome

    @property
    def severity(self) -> float:
        return self.stats.uncached_tokens + self.stats.unrecouped_cache_write_tokens


def classify_call_site(stats: CallSiteStats) -> Classification:
    """Classify token sums before traffic and instrumentation probes."""
    if stats.avg_input_tokens < MIN_CACHEABLE_PREFIX_TOKENS:
        return Classification(CacheOutcome.INELIGIBLE, OutcomeReason.SMALL_PROMPTS)
    if stats.call_count < MIN_CALLS_FOR_CONFIDENCE:
        return Classification(CacheOutcome.INELIGIBLE, OutcomeReason.LOW_VOLUME)
    if stats.sampled_call_count < MIN_SAMPLED_CALLS:
        return Classification(CacheOutcome.INELIGIBLE, OutcomeReason.FEW_STORED_SPANS)

    if (
        stats.sum_cache_creation_tokens > 0
        and stats.hit_rate < THRASH_MAX_HIT_RATE
        and stats.sum_cache_creation_tokens
        >= THRASH_MIN_CREATION_INPUT_FRACTION * stats.sum_input_tokens
    ):
        return Classification(CacheOutcome.THRASH, OutcomeReason.CACHE_ACTIVITY)

    if stats.hit_rate < NOT_CACHING_MAX_HIT_RATE:
        if stats.has_cache_activity:
            reason = OutcomeReason.CACHE_ACTIVITY
        elif reports_only_positive_cache_values(stats.model):
            reason = OutcomeReason.POSITIVE_ONLY_REPORTER
        else:
            reason = OutcomeReason.ZERO_CACHE_TOKENS
        return Classification(CacheOutcome.NOT_CACHING, reason)

    return Classification(CacheOutcome.HEALTHY, OutcomeReason.CACHE_ACTIVITY)


def reports_only_positive_cache_values(model: str) -> bool:
    normalized = model.lower()
    if any(marker in normalized for marker in POSITIVE_ONLY_CACHE_REPORTING_MODEL_MARKERS):
        return True
    return POSITIVE_ONLY_CACHE_REPORTING_MODEL_PATTERN.search(normalized) is not None
