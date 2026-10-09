"""Domain values for LLM prompt-cache usage detection."""

from __future__ import annotations

import math
import re
from collections import defaultdict
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum

from sentry.ai_monitoring.utils import canonical_model_name

DETECTION_WINDOW_DAYS = 7
CACHE_TTL_MINUTES = 5
LONG_CACHE_TTL_MINUTES = 60

# Provider documentation is the only source for cacheable prefix minimums:
# https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
# https://platform.openai.com/docs/guides/prompt-caching
# https://ai.google.dev/gemini-api/docs/caching
# Keys are canonical model names. A key covers variants and snapshots.
MIN_CACHEABLE_PREFIX_TOKENS_BY_MODEL: dict[str, int] = {
    "claude-fable-5": 512,
    "claude-mythos-5": 512,
    "claude-opus-5": 512,
    "claude-sonnet-5-5": 512,
    "claude-3-5-haiku": 2_048,
    "claude-mythos-preview": 2_048,
    "claude-opus-4-7": 2_048,
    "claude-haiku-4-5": 4_096,
    "claude-opus-4-5": 4_096,
    "claude-opus-4-6": 4_096,
    "gemini-2-5-flash": 2_048,
    "gemini-2-5-pro": 2_048,
    "gemini-3": 4_096,
}

# OpenAI and most Claude models use this minimum.
DEFAULT_MIN_CACHEABLE_PREFIX_TOKENS = 1_024
MIN_CALLS_FOR_CONFIDENCE = 200
MIN_SAMPLED_CALLS = 50
MIN_CACHEABLE_SHARE = 0.5
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
    UNKNOWN = "unknown"


FLAGGED_OUTCOMES = frozenset({CacheOutcome.NOT_CACHING, CacheOutcome.THRASH})


class OutcomeReason(StrEnum):
    SMALL_PROMPTS = "small_prompts"
    LOW_VOLUME = "low_volume"
    FEW_STORED_SPANS = "few_stored_spans"
    TOO_FEW_WARM_CALLS = "too_few_warm_calls"
    LOW_CACHEABLE_SHARE = "low_cacheable_share"
    WARM_ONLY_AT_LONG_TTL = "warm_only_at_long_ttl"
    CACHE_ACTIVITY = "cache_activity"
    ZERO_CACHE_TOKENS = "zero_cache_tokens"
    POSITIVE_ONLY_REPORTER = "positive_only_reporter"
    EXPLICIT_ZERO_CACHE_TOKENS = "explicit_zero_cache_tokens"
    NO_CACHE_ATTRIBUTES = "no_cache_attributes"
    BUDGET_EXHAUSTED = "budget_exhausted"
    OUT_OF_TIME = "out_of_time"
    UNQUERYABLE_CALL_SITE = "unqueryable_call_site"
    PROBE_FAILED = "probe_failed"


class ProbeGap(StrEnum):
    BUDGET_EXHAUSTED = "budget_exhausted"
    OUT_OF_TIME = "out_of_time"
    UNQUERYABLE = "unqueryable_call_site"
    FAILED = "probe_failed"


@dataclass(frozen=True)
class Classification:
    outcome: CacheOutcome
    reason: OutcomeReason


@dataclass(frozen=True)
class WarmthBucket:
    """One cache-TTL bucket of extrapolated calls and stored spans."""

    start: int
    call_count: float
    sample_count: float


def _warm_call_count(buckets: Iterable[WarmthBucket]) -> float:
    calls = 0.0
    cold_starts = 0.0
    for bucket in buckets:
        if bucket.call_count <= 0:
            continue
        calls += bucket.call_count
        cold_starts += (
            bucket.call_count / bucket.sample_count
            if bucket.sample_count > 0
            else bucket.call_count
        )
    return max(calls - cold_starts, 0.0)


def _widen_buckets(buckets: Iterable[WarmthBucket], minutes: int) -> list[WarmthBucket]:
    width = minutes * 60
    call_counts: defaultdict[int, float] = defaultdict(float)
    sample_counts: defaultdict[int, float] = defaultdict(float)
    for bucket in buckets:
        start = bucket.start - bucket.start % width
        call_counts[start] += bucket.call_count
        sample_counts[start] += bucket.sample_count
    return [
        WarmthBucket(start=start, call_count=call_count, sample_count=sample_counts[start])
        for start, call_count in call_counts.items()
    ]


@dataclass(frozen=True)
class CallSiteWarmth:
    """Calls that could reuse cache at default and longer TTLs."""

    total_call_count: float
    total_sample_count: float
    warm_call_count: float
    long_ttl_warm_call_count: float

    @classmethod
    def from_buckets(cls, buckets: Sequence[WarmthBucket]) -> CallSiteWarmth:
        return cls(
            total_call_count=sum(bucket.call_count for bucket in buckets if bucket.call_count > 0),
            total_sample_count=sum(bucket.sample_count for bucket in buckets),
            warm_call_count=_warm_call_count(buckets),
            long_ttl_warm_call_count=_warm_call_count(
                _widen_buckets(buckets, LONG_CACHE_TTL_MINUTES)
            ),
        )

    def _share(self, warm_call_count: float) -> float:
        if self.total_call_count <= 0:
            return 0.0
        return warm_call_count / self.total_call_count

    @property
    def cacheable_share(self) -> float:
        return self._share(self.warm_call_count)

    @property
    def long_ttl_cacheable_share(self) -> float:
        return self._share(self.long_ttl_warm_call_count)


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
    warmth: CallSiteWarmth | ProbeGap | None = None
    spans_with_cache_attributes: int | ProbeGap | None = None

    @property
    def outcome(self) -> CacheOutcome:
        return self.classification.outcome

    @property
    def severity(self) -> float:
        return self.stats.uncached_tokens + self.stats.unrecouped_cache_write_tokens


def classify_call_site(stats: CallSiteStats) -> Classification:
    """Classify token sums before traffic and instrumentation probes."""
    if stats.avg_input_tokens < min_cacheable_prefix_tokens(stats.model):
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


def min_cacheable_prefix_tokens(model: str) -> int:
    name = canonical_model_name(model)
    matches = [
        key
        for key in MIN_CACHEABLE_PREFIX_TOKENS_BY_MODEL
        if name == key or name.startswith(f"{key}-")
    ]
    if not matches:
        return DEFAULT_MIN_CACHEABLE_PREFIX_TOKENS
    return MIN_CACHEABLE_PREFIX_TOKENS_BY_MODEL[max(matches, key=len)]


def reports_only_positive_cache_values(model: str) -> bool:
    normalized = model.lower()
    if any(marker in normalized for marker in POSITIVE_ONLY_CACHE_REPORTING_MODEL_MARKERS):
        return True
    return POSITIVE_ONLY_CACHE_REPORTING_MODEL_PATTERN.search(normalized) is not None


def _warmth_shortfall(warm_call_count: float, cacheable_share: float) -> OutcomeReason | None:
    if warm_call_count < MIN_CALLS_FOR_CONFIDENCE:
        return OutcomeReason.TOO_FEW_WARM_CALLS
    if cacheable_share < MIN_CACHEABLE_SHARE:
        return OutcomeReason.LOW_CACHEABLE_SHARE
    return None


def resolve_with_warmth(
    classification: Classification, warmth: CallSiteWarmth | ProbeGap
) -> Classification:
    """Reject findings whose traffic could not have reused cache."""
    if isinstance(warmth, ProbeGap):
        return Classification(CacheOutcome.INELIGIBLE, OutcomeReason(warmth.value))
    shortfall = _warmth_shortfall(warmth.warm_call_count, warmth.cacheable_share)
    if shortfall is None:
        return classification
    if _warmth_shortfall(warmth.long_ttl_warm_call_count, warmth.long_ttl_cacheable_share) is None:
        return Classification(CacheOutcome.INELIGIBLE, OutcomeReason.WARM_ONLY_AT_LONG_TTL)
    return Classification(CacheOutcome.INELIGIBLE, shortfall)


def resolve_with_cache_presence(
    classification: Classification, spans_with_cache_attributes: int | ProbeGap
) -> Classification:
    """Distinguish explicit zero values from missing instrumentation."""
    if isinstance(spans_with_cache_attributes, ProbeGap):
        return Classification(
            CacheOutcome.UNKNOWN, OutcomeReason(spans_with_cache_attributes.value)
        )
    if spans_with_cache_attributes == 0:
        return Classification(CacheOutcome.UNKNOWN, OutcomeReason.NO_CACHE_ATTRIBUTES)
    return Classification(classification.outcome, OutcomeReason.EXPLICIT_ZERO_CACHE_TOKENS)
