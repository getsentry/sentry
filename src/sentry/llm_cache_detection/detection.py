"""Pure classification logic for LLM prompt-cache usage detection.

All ratios are computed from token sums, never from attribute-presence counts:
Gemini only records ``cache_read`` when it is > 0, so presence-based rates
would wildly overstate cache hit rates.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from enum import StrEnum

DETECTION_WINDOW_DAYS = 7

# Roughly one call per 5-minute provider cache TTL window over the detection
# window; sparser traffic cannot keep a cache warm.
MIN_CALLS_PER_WINDOW = 2_000
# Provider minimum cacheable prefix; below this caching cannot engage.
MIN_AVG_INPUT_TOKENS = 1024

# Hit rates are strongly bimodal: broken call sites sit near zero, healthy
# ones far above. Any cutoff in the gap works; 5% is robust to drift.
NOT_CACHING_MAX_HIT_RATE = 0.05

THRASH_MIN_WRITE_READ_RATIO = 2.0
THRASH_MAX_HIT_RATE = 0.30
# Only call it thrash when a substantial share of input is being written to
# cache; healthy write:read ratios sit far below 1.
THRASH_MIN_CREATION_INPUT_FRACTION = 0.3

CONTRAST_ANCHOR_MIN_HIT_RATE = 0.50

# Model families whose instrumentation records cache-token attributes only for
# positive values (Gemini omits cache_read when 0 and never reports writes on
# generate calls). For these, wholly-absent cache attributes are consistent
# with a genuine 0% hit rate. Everything else (Anthropic and OpenAI report
# zeros; unknown providers) treats absence as an instrumentation gap.
POSITIVE_ONLY_CACHE_REPORTING_MODEL_MARKERS = ("gemini",)


class CacheOutcome(StrEnum):
    HEALTHY = "healthy"
    NOT_CACHING = "not_caching"
    THRASH = "thrash"
    INELIGIBLE = "ineligible"
    UNKNOWN = "unknown"


FLAGGED_OUTCOMES = frozenset({CacheOutcome.NOT_CACHING, CacheOutcome.THRASH})


@dataclass(frozen=True)
class CallSiteStats:
    """Aggregates for one call-site group (transaction x span.description x model)."""

    transaction: str
    span_description: str
    model: str
    call_count: int
    sum_input_tokens: float
    sum_cache_read_tokens: float
    sum_cache_creation_tokens: float
    avg_input_tokens: float

    @property
    def group_key(self) -> tuple[str, str, str]:
        return (self.transaction, self.span_description, self.model)

    @property
    def hit_rate(self) -> float:
        if self.sum_input_tokens <= 0:
            return 0.0
        return self.sum_cache_read_tokens / self.sum_input_tokens

    @property
    def write_read_ratio(self) -> float | None:
        """Cache write:read ratio, or None when there are no reads to divide by."""
        if self.sum_cache_read_tokens <= 0:
            return None
        return self.sum_cache_creation_tokens / self.sum_cache_read_tokens

    @property
    def uncached_tokens(self) -> float:
        """Input tokens that were neither read from nor written to cache."""
        return max(
            self.sum_input_tokens - self.sum_cache_read_tokens - self.sum_cache_creation_tokens,
            0.0,
        )

    @property
    def unrecouped_cache_write_tokens(self) -> float:
        """Cache-write spend not paid back by reads."""
        return max(self.sum_cache_creation_tokens - self.sum_cache_read_tokens, 0.0)

    @property
    def has_cache_activity(self) -> bool:
        return self.sum_cache_read_tokens > 0 or self.sum_cache_creation_tokens > 0


@dataclass(frozen=True)
class ContrastAnchor:
    """A healthy call site using the same model in the same project.

    Evidence booster only, never a gate: it demonstrates the model can cache
    well in this project, pointing at the flagged call site's configuration.
    """

    transaction: str
    span_description: str
    model: str
    hit_rate: float


@dataclass(frozen=True)
class CacheFinding:
    outcome: CacheOutcome
    stats: CallSiteStats
    anchor: ContrastAnchor | None

    @property
    def severity(self) -> float:
        # Un-recouped cache writes keep thrash findings competitive: their
        # input is mostly cache traffic, so uncached tokens alone clamp to ~0.
        return self.stats.uncached_tokens + self.stats.unrecouped_cache_write_tokens


def classify_call_site(stats: CallSiteStats) -> CacheOutcome:
    """Classify a call-site group from its token sums.

    Assumes cache attributes are recorded on the group's provider path; callers
    must apply ``resolve_with_cache_presence`` when ``needs_cache_presence_probe``
    is true, since a group whose spans never carry cache attributes at all is
    indistinguishable from a 0%-hit group by sums alone.
    """
    if stats.call_count < MIN_CALLS_PER_WINDOW or stats.avg_input_tokens < MIN_AVG_INPUT_TOKENS:
        return CacheOutcome.INELIGIBLE

    creation_tokens = stats.sum_cache_creation_tokens
    # Thrash first: a call site paying the cache-write premium without
    # collecting reads is a more specific finding than a low hit rate.
    if (
        creation_tokens > 0
        and stats.hit_rate < THRASH_MAX_HIT_RATE
        and creation_tokens >= THRASH_MIN_WRITE_READ_RATIO * stats.sum_cache_read_tokens
        and creation_tokens >= THRASH_MIN_CREATION_INPUT_FRACTION * stats.sum_input_tokens
    ):
        return CacheOutcome.THRASH

    if stats.hit_rate < NOT_CACHING_MAX_HIT_RATE:
        return CacheOutcome.NOT_CACHING

    return CacheOutcome.HEALTHY


def reports_only_positive_cache_values(model: str) -> bool:
    normalized = model.lower()
    return any(marker in normalized for marker in POSITIVE_ONLY_CACHE_REPORTING_MODEL_MARKERS)


def needs_cache_presence_probe(stats: CallSiteStats, outcome: CacheOutcome) -> bool:
    """Whether the instrumentation-gap guard requires a presence probe.

    Zero cache-token sums can mean either "never caches" or "instrumentation
    never emits cache attributes" (e.g. wrapper paths that drop them). Only a
    flagged group with no cache activity at all is ambiguous — and only on
    models that report zero values: for positive-only reporters, absent
    attributes are exactly what a genuine 0% hit rate looks like, so the
    finding stands without a probe. The guard deliberately ignores whether the
    same model reports cache attributes at *other* call sites: the known gap
    (a wrapper path dropping attributes) occurs on models that record them
    fine elsewhere in the same project.
    """
    return (
        outcome in FLAGGED_OUTCOMES
        and not stats.has_cache_activity
        and not reports_only_positive_cache_values(stats.model)
    )


def resolve_with_cache_presence(
    outcome: CacheOutcome, spans_with_cache_attributes_count: int | None
) -> CacheOutcome:
    """Apply the instrumentation-gap guard: attributes wholly absent -> UNKNOWN.

    ``None`` means presence could not be determined and resolves to UNKNOWN too.
    """
    if not spans_with_cache_attributes_count:
        return CacheOutcome.UNKNOWN
    return outcome


def find_contrast_anchor(
    stats: CallSiteStats, all_stats: Sequence[CallSiteStats]
) -> ContrastAnchor | None:
    """Find the best same-model, high-hit-rate call site elsewhere in the project."""
    best: CallSiteStats | None = None
    for candidate in all_stats:
        if candidate.group_key == stats.group_key:
            continue
        if candidate.model != stats.model:
            continue
        if candidate.call_count < MIN_CALLS_PER_WINDOW:
            continue
        if candidate.hit_rate < CONTRAST_ANCHOR_MIN_HIT_RATE:
            continue
        if best is None or candidate.hit_rate > best.hit_rate:
            best = candidate
    if best is None:
        return None
    return ContrastAnchor(
        transaction=best.transaction,
        span_description=best.span_description,
        model=best.model,
        hit_rate=best.hit_rate,
    )
