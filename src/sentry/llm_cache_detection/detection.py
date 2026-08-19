"""Pure classification logic for LLM prompt-cache usage detection.

All ratios are computed from token sums, never from attribute-presence counts:
Gemini only records ``cache_read`` when it is > 0, so presence-based rates
would wildly overstate cache hit rates.
"""

from __future__ import annotations

import re
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum

DETECTION_WINDOW_DAYS = 7

# Provider prompt caches expire on this order, so a call meets a warm cache only
# when the same call site made an earlier one within this long.
CACHE_TTL_MINUTES = 5
# Provider minimum cacheable prefix; below this caching cannot engage.
MIN_AVG_INPUT_TOKENS = 1024

# How many calls a ratio has to be computed over before it is worth acting on.
# A few hundred is where the token ratios settle: under it a handful of unusual
# calls moves the rate around, over it the near-zero rates this flags stay far
# away from the rates a working cache reaches. Cache mechanics ask for no more
# than that; the number is a question about evidence, not about caching.
MIN_CALLS_FOR_CONFIDENCE = 200

# Whether a call site can cache at all is a property of the gaps between its
# calls rather than of how many it makes: traffic spaced wider than the TTL
# meets a cold cache however much of it there is. Hit rates still count every
# call, since which of them a token sum came from is not recoverable, so this
# floor is what bounds the resulting dilution: with most of the traffic
# cache-eligible, a rate below NOT_CACHING_MAX_HIT_RATE cannot come from the
# isolated calls weighing it down, the eligible ones have to be missing too.
MIN_CACHEABLE_SHARE = 0.5

# Hit rates are strongly bimodal: broken call sites sit near zero, healthy
# ones far above. Any cutoff in the gap works; 5% is robust to drift.
NOT_CACHING_MAX_HIT_RATE = 0.05

THRASH_MIN_WRITE_READ_RATIO = 2.0
THRASH_MAX_HIT_RATE = 0.30
# Only call it thrash when a substantial share of input is being written to
# cache; healthy write:read ratios sit far below 1.
THRASH_MIN_CREATION_INPUT_FRACTION = 0.3

CONTRAST_ANCHOR_MIN_HIT_RATE = 0.50

# Model families whose instrumentation records cache tokens only when positive:
# Gemini omits cache_read at zero, and the OpenAI integration discards any zero
# token value before recording. For these, absent attributes are consistent with
# a genuine 0% hit rate; Anthropic records real zeros, so for it and for unknown
# providers absence is treated as an instrumentation gap.
#
# Matching on model name is crude, but nothing on the span states the provider.
POSITIVE_ONLY_CACHE_REPORTING_MODEL_MARKERS = ("gemini", "gpt")
# The same OpenAI integration wraps the reasoning models, whose names carry no
# `gpt` at all (`o3`, `o4-mini`, `openai/o1-preview`). Matched only at the start
# of the id or of its provider-namespaced suffix, so that arbitrary deployment
# names do not claim the exemption and lose their instrumentation-gap guard.
POSITIVE_ONLY_CACHE_REPORTING_MODEL_PATTERN = re.compile(r"(?:^|[/:])o\d")


@dataclass(frozen=True)
class DetectionWindow:
    """The span of time one detection run reads.

    Fixed once per run and threaded through every query so the aggregates, the
    instrumentation-gap probe and the sampled calls all describe the same window,
    and so the issue can state the window it was derived from.
    """

    start: datetime
    end: datetime

    @classmethod
    def ending_now(cls) -> DetectionWindow:
        end = datetime.now(UTC)
        return cls(start=end - timedelta(days=DETECTION_WINDOW_DAYS), end=end)


class AgentLabelSource(StrEnum):
    """Which span attribute a call site's agent label was read from.

    Named for the attribute itself so evidence states the provenance rather than
    a private code for it: a reader shown an operation name where they expected
    an agent has to be able to tell a fallback from a mislabelled agent.
    """

    AGENT_NAME = "gen_ai.agent.name"
    OPERATION_NAME = "gen_ai.operation.name"


class CacheOutcome(StrEnum):
    HEALTHY = "healthy"
    NOT_CACHING = "not_caching"
    THRASH = "thrash"
    INELIGIBLE = "ineligible"
    UNKNOWN = "unknown"


FLAGGED_OUTCOMES = frozenset({CacheOutcome.NOT_CACHING, CacheOutcome.THRASH})


@dataclass(frozen=True)
class CallSiteWarmth:
    """How much of a call site's traffic could have met a warm cache.

    Read off calls bucketed at the cache TTL rather than off the gaps between
    them, which EAP cannot express: inside a bucket every call after the first
    has a predecessor closer than the TTL, and the first is charged as a cold
    start. Two calls a second apart on either side of a bucket boundary
    therefore read as two cold starts, which understates warmth -- the direction
    that costs a finding rather than inventing one.
    """

    total_call_count: float
    warm_call_count: float

    @classmethod
    def from_bucket_counts(cls, bucket_counts: Iterable[float]) -> CallSiteWarmth:
        total_call_count = 0.0
        cold_starts = 0
        for count in bucket_counts:
            if count <= 0:
                continue
            total_call_count += count
            cold_starts += 1
        return cls(
            total_call_count=total_call_count,
            warm_call_count=max(total_call_count - cold_starts, 0.0),
        )

    @property
    def cacheable_share(self) -> float:
        if self.total_call_count <= 0:
            return 0.0
        return self.warm_call_count / self.total_call_count


@dataclass(frozen=True)
class CallSiteStats:
    """Aggregates for one call-site group (agent label x span.name x model).

    The transaction is deliberately not part of this: one call site reached from
    a task and from a request handler is one place in the code with one cache
    configuration, and splitting it by entry point would file the same finding
    twice.
    """

    agent_label: str
    agent_label_source: AgentLabelSource
    span_name: str
    model: str
    call_count: int
    sum_input_tokens: float
    sum_cache_read_tokens: float
    sum_cache_creation_tokens: float
    avg_input_tokens: float

    @property
    def group_key(self) -> tuple[str, str, str, str]:
        # The label's source belongs to the identity rather than decorating it:
        # an agent genuinely named `chat` and the fallback label for spans that
        # carry no agent name are different call sites that would otherwise
        # share a key.
        return (
            self.agent_label_source.value,
            self.agent_label,
            self.span_name,
            self.model,
        )

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
        """Input tokens that were neither read from nor written to cache.

        Assumes input tokens include the cached ones, as the conventions specify.
        A provider that reports them exclusively instead clamps this to zero, which
        sorts the call site last rather than misreporting it.
        """
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

    agent_label: str
    agent_label_source: AgentLabelSource
    span_name: str
    model: str
    hit_rate: float
    call_count: int
    avg_input_tokens: float


@dataclass(frozen=True)
class CacheFinding:
    outcome: CacheOutcome
    stats: CallSiteStats
    anchor: ContrastAnchor | None
    # Measured only for a call site that is already a candidate: it costs a
    # query of its own, and nothing short of a finding reads it.
    warmth: CallSiteWarmth | None = None

    @property
    def severity(self) -> float:
        # Un-recouped cache writes keep thrash findings competitive: their
        # input is mostly cache traffic, so uncached tokens alone clamp to ~0.
        return self.stats.uncached_tokens + self.stats.unrecouped_cache_write_tokens


def classify_call_site(stats: CallSiteStats) -> CacheOutcome:
    """Classify a call-site group from its token sums.

    Eligibility is only half-answered here. Whether a call site's traffic arrives
    closely enough spaced to meet a warm cache at all costs a query of its own,
    so callers settle it with ``resolve_with_warmth`` on the groups this flags,
    which are the only ones an answer changes anything for -- a hit rate high
    enough to read as healthy is itself proof that the cache warms. Until then
    the call count stands in for it: it is the ceiling on how many of a group's
    calls could have been cache-eligible, so a group short of the floor on its
    total cannot reach it on the warm subset either.

    Assumes cache attributes are recorded on the group's provider path; callers
    must apply ``resolve_with_cache_presence`` when ``needs_cache_presence_probe``
    is true, since a group whose spans never carry cache attributes at all is
    indistinguishable from a 0%-hit group by sums alone.
    """
    if stats.avg_input_tokens < MIN_AVG_INPUT_TOKENS or stats.call_count < MIN_CALLS_FOR_CONFIDENCE:
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


def resolve_with_warmth(outcome: CacheOutcome, warmth: CallSiteWarmth | None) -> CacheOutcome:
    """Apply the warmth half of eligibility: traffic too sparse to cache -> INELIGIBLE.

    A hit rate is a verdict only on a call site that had a warm cache to hit.
    Traffic spaced wider than the TTL meets a cold one however much of it there
    is, and the 0% that follows is arithmetic rather than a defect anyone can
    fix. The share floor also bounds what the hit rate's denominator hides: it
    counts every call, including ones no cache could have served, so demanding
    that most of them could is what keeps isolated traffic from reading as a
    broken cache.

    ``None`` means warmth could not be measured, which answers neither question.
    """
    if (
        warmth is None
        or warmth.warm_call_count < MIN_CALLS_FOR_CONFIDENCE
        or warmth.cacheable_share < MIN_CACHEABLE_SHARE
    ):
        return CacheOutcome.INELIGIBLE
    return outcome


def reports_only_positive_cache_values(model: str) -> bool:
    normalized = model.lower()
    if any(marker in normalized for marker in POSITIVE_ONLY_CACHE_REPORTING_MODEL_MARKERS):
        return True
    return POSITIVE_ONLY_CACHE_REPORTING_MODEL_PATTERN.search(normalized) is not None


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
    candidates = (
        candidate
        for candidate in all_stats
        if candidate.group_key != stats.group_key
        and candidate.model == stats.model
        # An anchor is only asked the sample-size question: a hit rate this high
        # is itself the proof that its cache warms, so nothing further has to be
        # measured about the shape of its traffic.
        and candidate.call_count >= MIN_CALLS_FOR_CONFIDENCE
        and candidate.hit_rate >= CONTRAST_ANCHOR_MIN_HIT_RATE
    )
    best = max(candidates, key=lambda candidate: candidate.hit_rate, default=None)
    if best is None:
        return None
    return ContrastAnchor(
        agent_label=best.agent_label,
        agent_label_source=best.agent_label_source,
        span_name=best.span_name,
        model=best.model,
        hit_rate=best.hit_rate,
        call_count=best.call_count,
        avg_input_tokens=best.avg_input_tokens,
    )
