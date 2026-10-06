"""Pure classification logic for LLM prompt-cache usage detection.

Ratios come from token sums, never attribute-presence counts: Gemini records
``cache_read`` only when positive, so presence-based rates would overstate hits.
"""

from __future__ import annotations

import math
import re
from collections import defaultdict
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from difflib import SequenceMatcher
from enum import StrEnum

from sentry.ai_monitoring.utils import canonical_model_name

DETECTION_WINDOW_DAYS = 7

# Warmth is judged at the shortest default TTL, Anthropic's. Under a longer one,
# such as Anthropic's opt-in hour or OpenAI's 30-minute default on recent models,
# calls further apart still meet a warm cache. The span does not say which TTL a
# call site sets, so traffic warm only at the long TTL is reported, not flagged.
CACHE_TTL_MINUTES = 5
LONG_CACHE_TTL_MINUTES = 60

# The shortest prompt prefix a model caches, where it differs from the default.
# The model-price feeds do not carry it, so it is copied from the providers'
# docs. Keys are canonical names (see `canonical_model_name`); a key
# covers its variants and snapshots, and the longest matching key wins.
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

# OpenAI's, and most Claude models'.
DEFAULT_MIN_CACHEABLE_PREFIX_TOKENS = 1_024

# Where token ratios settle enough to act on; a question of evidence, not caching.
MIN_CALLS_FOR_CONFIDENCE = 200

# `MIN_CALLS_FOR_CONFIDENCE` counts extrapolated calls, but ratios come from the
# stored spans. Lower, because bimodal rates take few observations to tell apart.
MIN_SAMPLED_CALLS = 50

# Hit rates count calls no warm cache could have served. Requiring most calls to
# be cache-eligible keeps isolated traffic from diluting a rate below the cutoff.
MIN_CACHEABLE_SHARE = 0.5

# Hit rates are bimodal: broken call sites sit near zero, healthy ones far above.
NOT_CACHING_MAX_HIT_RATE = 0.05

THRASH_MAX_HIT_RATE = 0.30

# With the hit-rate ceiling, this puts the write:read ratio above 1:1, so the
# ratio needs no threshold of its own. Whether that costs money is pricing's call.
THRASH_MIN_CREATION_INPUT_FRACTION = 0.3

CONTRAST_ANCHOR_MIN_HIT_RATE = 0.50

# Instrumentation that records cache tokens only when positive (Gemini omits a
# zero cache_read; the OpenAI integration drops zero values), so absent
# attributes there are a genuine 0% hit rate rather than a gap. Nothing on the
# span names the provider, so the model name stands in.
POSITIVE_ONLY_CACHE_REPORTING_MODEL_MARKERS = ("gemini", "gpt")

# OpenAI reasoning models (`o3`, `openai/o1-preview`), anchored so that arbitrary
# deployment names do not claim the exemption.
POSITIVE_ONLY_CACHE_REPORTING_MODEL_PATTERN = re.compile(r"(?:^|[/:])o\d")


@dataclass(frozen=True)
class DetectionWindow:
    """The time range one run reads, fixed so every query describes the same one."""

    start: datetime
    end: datetime

    @classmethod
    def ending_now(cls) -> DetectionWindow:
        end = datetime.now(UTC)
        return cls(start=end - timedelta(days=DETECTION_WINDOW_DAYS), end=end)


class AgentLabelSource(StrEnum):
    """Which span attribute a call site's agent label was read from."""

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
    """The rule that settled a call site's outcome. INELIGIBLE and UNKNOWN each
    have several, so the outcome alone does not say."""

    # Ineligible on the token sums.
    SMALL_PROMPTS = "small_prompts"
    LOW_VOLUME = "low_volume"
    FEW_STORED_SPANS = "few_stored_spans"
    # Ineligible on how the traffic is spaced.
    TOO_FEW_WARM_CALLS = "too_few_warm_calls"
    LOW_CACHEABLE_SHARE = "low_cacheable_share"
    # Spaced too far apart for the default TTL but not for the long one: a broken
    # cache if the call site sets the long TTL, too short a TTL if it does not.
    WARM_ONLY_AT_LONG_TTL = "warm_only_at_long_ttl"
    # Cache tokens were recorded, so the sums settle the outcome.
    CACHE_ACTIVITY = "cache_activity"
    # No cache tokens at all, before the presence probe has said whether the
    # spans carry the attributes.
    ZERO_CACHE_TOKENS = "zero_cache_tokens"
    # No cache tokens on a model whose instrumentation omits zeros.
    POSITIVE_ONLY_REPORTER = "positive_only_reporter"
    # No cache tokens, but the spans carry the attributes: a real zero.
    EXPLICIT_ZERO_CACHE_TOKENS = "explicit_zero_cache_tokens"
    # No span carries the attributes: an instrumentation gap.
    NO_CACHE_ATTRIBUTES = "no_cache_attributes"
    # A probe the outcome depended on went unanswered; see `ProbeGap`.
    BUDGET_EXHAUSTED = "budget_exhausted"
    OUT_OF_TIME = "out_of_time"
    UNQUERYABLE_CALL_SITE = "unqueryable_call_site"
    PROBE_FAILED = "probe_failed"


class ProbeGap(StrEnum):
    """Why a probe left its question unanswered."""

    BUDGET_EXHAUSTED = "budget_exhausted"
    # Past the point in a project's run where no more probes start.
    OUT_OF_TIME = "out_of_time"
    # A call-site value the search grammar cannot match exactly.
    UNQUERYABLE = "unqueryable_call_site"
    FAILED = "probe_failed"


PROBE_GAP_REASONS: dict[ProbeGap, OutcomeReason] = {
    ProbeGap.BUDGET_EXHAUSTED: OutcomeReason.BUDGET_EXHAUSTED,
    ProbeGap.OUT_OF_TIME: OutcomeReason.OUT_OF_TIME,
    ProbeGap.UNQUERYABLE: OutcomeReason.UNQUERYABLE_CALL_SITE,
    ProbeGap.FAILED: OutcomeReason.PROBE_FAILED,
}


@dataclass(frozen=True)
class Classification:
    outcome: CacheOutcome
    reason: OutcomeReason


@dataclass(frozen=True)
class WarmthBucket:
    """One cache-TTL bucket of a call site's traffic: when it starts (epoch
    seconds), extrapolated calls, and the stored spans the estimate rests on."""

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
    """Merge buckets into wider ones aligned to ``minutes``, summing both counts."""
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
    """How much of a call site's traffic could have met a warm cache, at the
    default TTL and at the long one.

    EAP cannot take the gap between consecutive calls, so calls are bucketed at
    the TTL: within a bucket every call after the first had a warm cache. A
    boundary between two close calls reads as two cold starts, which errs
    towards missing a finding rather than inventing one. Sampling erases spacing,
    so each bucket's cold start counts as many calls as one stored span stands for.
    """

    total_call_count: float
    # The stored spans behind the counts. Fewer than the call-site aggregate saw
    # means a more heavily sampled answer, and so understated warmth.
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
    """Aggregates for one call site (agent label x span.name x model).

    Not keyed by transaction: one call site reached from two entry points is one
    place in the code with one cache configuration. ``call_count`` is
    extrapolated; ``sampled_call_count`` is the stored spans the sums come from.
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
        # The source is part of the identity: an agent named `chat` and unnamed
        # spans whose operation is `chat` are different call sites.
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
        """Input tokens neither read from nor written to cache.

        Assumes input includes cached tokens, as the conventions specify; see
        ``cache_exceeds_input`` for providers that report them exclusively.
        """
        return max(
            self.sum_input_tokens - self.sum_cache_read_tokens - self.sum_cache_creation_tokens,
            0.0,
        )

    @property
    def cache_exceeds_input(self) -> bool:
        """Cache tokens adding up to more than the input that should include them.

        Marks a provider reporting input exclusive of cached tokens, which skews
        every ratio here. The tolerance absorbs rounding in extrapolated sums.
        """
        cache_tokens = self.sum_cache_read_tokens + self.sum_cache_creation_tokens
        return cache_tokens > self.sum_input_tokens and not math.isclose(
            cache_tokens, self.sum_input_tokens
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
    """A healthy call site on the same model in the same project: evidence that
    the flagged one's configuration is at fault. Its absence never blocks a finding."""

    agent_label: str
    agent_label_source: AgentLabelSource
    span_name: str
    model: str
    hit_rate: float
    call_count: int
    avg_input_tokens: float


@dataclass(frozen=True)
class CacheFinding:
    classification: Classification
    stats: CallSiteStats
    anchor: ContrastAnchor | None
    # Probed only for candidates, at a query each.
    warmth: CallSiteWarmth | ProbeGap | None = None
    spans_with_cache_attributes: int | ProbeGap | None = None

    @property
    def outcome(self) -> CacheOutcome:
        return self.classification.outcome

    @property
    def severity(self) -> float:
        # Thrash input is mostly cache traffic, so its uncached tokens are ~0.
        return self.stats.uncached_tokens + self.stats.unrecouped_cache_write_tokens


def classify_call_site(stats: CallSiteStats) -> Classification:
    """Classify a call site from its token sums.

    Flagged outcomes are provisional: callers settle them with
    ``resolve_with_warmth``, then ``resolve_with_cache_presence`` where
    ``needs_cache_presence_probe`` says the zero sums are ambiguous. A healthy
    hit rate needs neither, being proof by itself that the cache warms.
    """
    # The average bounds the prefix from above: below the minimum, most calls
    # cannot have a cacheable one.
    if stats.avg_input_tokens < min_cacheable_prefix_tokens(stats.model):
        return Classification(CacheOutcome.INELIGIBLE, OutcomeReason.SMALL_PROMPTS)
    if stats.call_count < MIN_CALLS_FOR_CONFIDENCE:
        return Classification(CacheOutcome.INELIGIBLE, OutcomeReason.LOW_VOLUME)
    if stats.sampled_call_count < MIN_SAMPLED_CALLS:
        return Classification(CacheOutcome.INELIGIBLE, OutcomeReason.FEW_STORED_SPANS)

    creation_tokens = stats.sum_cache_creation_tokens
    # Thrash first: it is the more specific reading of a low hit rate.
    if (
        creation_tokens > 0
        and stats.hit_rate < THRASH_MAX_HIT_RATE
        and creation_tokens >= THRASH_MIN_CREATION_INPUT_FRACTION * stats.sum_input_tokens
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


def _warmth_shortfall(warm_call_count: float, cacheable_share: float) -> OutcomeReason | None:
    if warm_call_count < MIN_CALLS_FOR_CONFIDENCE:
        return OutcomeReason.TOO_FEW_WARM_CALLS
    if cacheable_share < MIN_CACHEABLE_SHARE:
        return OutcomeReason.LOW_CACHEABLE_SHARE
    return None


def resolve_with_warmth(
    classification: Classification, warmth: CallSiteWarmth | ProbeGap
) -> Classification:
    """Traffic too sparse to meet a warm cache -> INELIGIBLE: its 0% hit rate is
    arithmetic, not a defect. Unmeasured warmth is treated the same."""
    if isinstance(warmth, ProbeGap):
        return Classification(CacheOutcome.INELIGIBLE, PROBE_GAP_REASONS[warmth])
    shortfall = _warmth_shortfall(warmth.warm_call_count, warmth.cacheable_share)
    if shortfall is None:
        return classification
    if _warmth_shortfall(warmth.long_ttl_warm_call_count, warmth.long_ttl_cacheable_share) is None:
        return Classification(CacheOutcome.INELIGIBLE, OutcomeReason.WARM_ONLY_AT_LONG_TTL)
    return Classification(CacheOutcome.INELIGIBLE, shortfall)


def reports_only_positive_cache_values(model: str) -> bool:
    normalized = model.lower()
    if any(marker in normalized for marker in POSITIVE_ONLY_CACHE_REPORTING_MODEL_MARKERS):
        return True
    return POSITIVE_ONLY_CACHE_REPORTING_MODEL_PATTERN.search(normalized) is not None


def needs_cache_presence_probe(classification: Classification) -> bool:
    """Whether zero cache-token sums are ambiguous between "never caches" and
    "instrumentation never emits the attributes".

    Other call sites on the same model are no evidence either way: the known gap
    is a wrapper path dropping attributes the same model records elsewhere.
    """
    return classification.reason is OutcomeReason.ZERO_CACHE_TOKENS


def resolve_with_cache_presence(
    classification: Classification, spans_with_cache_attributes: int | ProbeGap
) -> Classification:
    """Attributes wholly absent, or presence unmeasured -> UNKNOWN."""
    if isinstance(spans_with_cache_attributes, ProbeGap):
        return Classification(CacheOutcome.UNKNOWN, PROBE_GAP_REASONS[spans_with_cache_attributes])
    if spans_with_cache_attributes == 0:
        return Classification(CacheOutcome.UNKNOWN, OutcomeReason.NO_CACHE_ATTRIBUTES)
    return Classification(classification.outcome, OutcomeReason.EXPLICIT_ZERO_CACHE_TOKENS)


def find_contrast_anchor(
    stats: CallSiteStats, all_stats: Sequence[CallSiteStats]
) -> ContrastAnchor | None:
    """Find the best same-model, high-hit-rate call site elsewhere in the project."""
    candidates = (
        candidate
        for candidate in all_stats
        if candidate.group_key != stats.group_key
        and candidate.model == stats.model
        # A hit rate this high proves its cache warms; only volume is checked.
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


MIN_PROMPT_SAMPLES = 2

# A prompt reads as misordered with less than this shared up front and at least
# this much identical content stranded behind the divergence.
MIN_STABLE_BLOCK_CHARS = 256

# Room for a whole value (the longest, a UUID, is 36 chars) either side of the
# point where the prompts stop agreeing.
DIVERGENCE_WINDOW_CHARS = 128

# What follows the divergence is aligned in pieces, so a block still lines up when
# the variable text ahead of it changes length. Prompts without line breaks are
# cut at this fixed size instead.
STABLE_BLOCK_SEGMENT_CHARS = 256

# Aligning pieces is quadratic in repeated ones, so a prompt of many short lines
# (padding, tables, scraped text) is cut at the fixed size too. Prose and code
# within the fetched length stay under this.
MAX_STABLE_BLOCK_LINE_SEGMENTS = 1_000


class DivergenceKind(StrEnum):
    """What sits at the point where a call site's sampled prompts stop agreeing."""

    NONE = "none"
    ISO_TIMESTAMP = "iso_timestamp"
    EPOCH_TIMESTAMP = "epoch_timestamp"
    UUID = "uuid"
    IDENTIFIER = "identifier"
    COUNTER = "counter"
    OTHER = "other"


# Most specific first: the first pattern covering the divergence names it, and
# the bare digit run would swallow everything else built out of digits.
DIVERGENCE_PATTERNS: tuple[tuple[DivergenceKind, re.Pattern[str]], ...] = (
    (
        DivergenceKind.ISO_TIMESTAMP,
        re.compile(r"\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?"),
    ),
    (
        DivergenceKind.UUID,
        re.compile(
            r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b", re.IGNORECASE
        ),
    ),
    # Hex ids of trace/span length, or prefixed opaque ids; the tail must hold a
    # digit so that ordinary snake_case words do not match.
    (
        DivergenceKind.IDENTIFIER,
        re.compile(
            r"\b(?:[0-9a-f]{16,}"
            r"|(?:req|request|trace|span|session|conversation|thread|run|correlation)"
            r"[-_](?:id[-_])?(?=[0-9a-z]*\d)[0-9a-z]{6,})\b",
            re.IGNORECASE,
        ),
    ),
    # Epoch seconds or milliseconds, narrow enough that other large numbers stay
    # counters.
    (DivergenceKind.EPOCH_TIMESTAMP, re.compile(r"\b1\d{9}(?:\d{3})?\b")),
    (DivergenceKind.COUNTER, re.compile(r"\d+")),
)


@dataclass(frozen=True)
class PromptDivergence:
    """Where a call site's sampled prompts stop agreeing, and what sits there.

    A provider caches a prefix, so caching stops where the prompts diverge. Only
    lengths (in characters, the attribute's unit) and the kind of the diverging
    value are kept, never prompt text. Prompts are truncated as they are read, so
    ``stable_block_chars`` is a floor.
    """

    sample_count: int
    common_prefix_chars: int
    shortest_prompt_chars: int
    divergence_kind: DivergenceKind
    stable_block_chars: int

    @property
    def prefix_share(self) -> float:
        """How much of the shortest sampled prompt the shared prefix covers."""
        if self.shortest_prompt_chars <= 0:
            return 0.0
        return self.common_prefix_chars / self.shortest_prompt_chars

    @property
    def template_misordered(self) -> bool:
        """Whether stable content sits behind the variable part, where it would
        have been cacheable had the template put it first."""
        return (
            self.common_prefix_chars < MIN_STABLE_BLOCK_CHARS
            and self.stable_block_chars >= MIN_STABLE_BLOCK_CHARS
        )


class PromptDiagnosisGap(StrEnum):
    """Why a finding carries no prompt diagnosis."""

    UNQUERYABLE = "unqueryable_call_site"
    # Sending prompt text is opt-in and usually off, so this is the common case.
    NO_PROMPT_TEXT = "no_prompt_text"
    TOO_FEW_SAMPLES = "too_few_samples"
    OUT_OF_TIME = "out_of_time"
    FAILED = "failed"


def _common_prefix_length(prompts: Sequence[str]) -> int:
    shortest = min(prompts, key=len)
    for index, character in enumerate(shortest):
        if any(prompt[index] != character for prompt in prompts):
            return index
    return len(shortest)


def _segment(text: str) -> list[str]:
    """Cut a prompt tail into pieces that can be aligned across samples, at
    newlines either literal or escaped by the message-list serialization, or at
    a fixed size where those are absent or too many."""
    pieces = [piece for piece in re.split(r"(?<=\\n)|(?<=\n)", text) if piece]
    if 1 < len(pieces) <= MAX_STABLE_BLOCK_LINE_SEGMENTS:
        return pieces
    return [
        text[offset : offset + STABLE_BLOCK_SEGMENT_CHARS]
        for offset in range(0, len(text), STABLE_BLOCK_SEGMENT_CHARS)
    ]


def _stable_block_chars(prompts: Sequence[str], *, start: int) -> int:
    """Size of the largest identical block every sample carries after ``start``.

    Anywhere after it, not just the tail: the user's own turn usually ends the
    prompt, so stranded stable content sits in the middle. With more than two
    samples the pairing that shares least is reported.
    """
    tails = [_segment(prompt[start:]) for prompt in prompts]
    reference = tails[0]
    shared: int | None = None
    for other in tails[1:]:
        # The junk heuristic would discard the repeated lines a stable block is.
        matcher = SequenceMatcher(a=reference, b=other, autojunk=False)
        largest = max(
            (
                sum(len(piece) for piece in reference[block.a : block.a + block.size])
                for block in matcher.get_matching_blocks()
            ),
            default=0,
        )
        shared = largest if shared is None else min(shared, largest)
    return shared or 0


def _classify_divergence(prompt: str, divergence_index: int) -> DivergenceKind:
    """Name the value straddling the point where the prompts stop agreeing, read
    from a window around it so matches elsewhere cannot claim it."""
    window_start = max(divergence_index - DIVERGENCE_WINDOW_CHARS, 0)
    window = prompt[window_start : divergence_index + DIVERGENCE_WINDOW_CHARS]
    boundary = divergence_index - window_start
    for kind, pattern in DIVERGENCE_PATTERNS:
        if any(match.start() <= boundary < match.end() for match in pattern.finditer(window)):
            return kind
    return DivergenceKind.OTHER


def diagnose_prompt_divergence(prompts: Sequence[str]) -> PromptDivergence | None:
    """Locate where one call site's sampled prompts stop agreeing, or return None
    with fewer than two to compare.

    Prompts are compared as the SDK serialized them: a proxy for the cached token
    sequence, good enough to say where a template starts varying.
    """
    usable = [prompt for prompt in prompts if prompt]
    if len(usable) < MIN_PROMPT_SAMPLES:
        return None

    shortest_prompt_chars = min(len(prompt) for prompt in usable)
    common_prefix_chars = _common_prefix_length(usable)
    if common_prefix_chars >= shortest_prompt_chars:
        # The prompts only grow at the end, the shape a cache wants.
        divergence_kind = DivergenceKind.NONE
        stable_block_chars = 0
    else:
        # Any one sample shows the shape of the token the template varies there.
        divergence_kind = _classify_divergence(usable[0], common_prefix_chars)
        stable_block_chars = _stable_block_chars(usable, start=common_prefix_chars)

    return PromptDivergence(
        sample_count=len(usable),
        common_prefix_chars=common_prefix_chars,
        shortest_prompt_chars=shortest_prompt_chars,
        divergence_kind=divergence_kind,
        stable_block_chars=stable_block_chars,
    )
