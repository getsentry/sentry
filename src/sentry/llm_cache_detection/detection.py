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
from difflib import SequenceMatcher
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

# The floor above counts calls the call site really made, which sampling lets a
# far smaller number of spans stand for. The ratios are only ever computed over
# the spans that were stored, so they need a floor of their own: an org sampled
# at a low rate would otherwise clear 200 calls on a couple of dozen spans and
# have a hit rate read off those. Set well below the call floor because the
# rates this flags are bimodal -- telling near-zero from healthy takes far fewer
# observations than pinning down where in between a rate sits.
MIN_SAMPLED_CALLS = 50

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

THRASH_MAX_HIT_RATE = 0.30
# Only call it thrash when a substantial share of input is being written to
# cache. Together with the hit-rate ceiling this is also what bounds the
# write:read ratio, with no need to threshold that ratio separately: writes at
# or above this share of input and reads below the ceiling put the ratio above
# 1:1, meaning a written token is read back at most once and the cache has
# amortised nothing.
#
# Where that starts costing real money rather than merely wasting the cache
# depends on the write premium, which the span does not record: against a 1.25x
# premium caching stops paying for itself at 3.6:1, but against 2x it is 0.9:1.
# Findings are raised across that whole range and the money is left to pricing,
# which knows the premium and reports an overpay only when there is one.
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
class WarmthBucket:
    """One cache-TTL bucket of a call site's traffic, as EAP reports it.

    ``call_count`` is extrapolated to the volume the bucket stands for, while
    ``sample_count`` is how many stored spans that estimate rests on. Warmth
    needs both: the first is the quantity being split into warm and cold, the
    second is the resolution the split can be seen at.
    """

    call_count: float
    sample_count: float


@dataclass(frozen=True)
class CallSiteWarmth:
    """How much of a call site's traffic could have met a warm cache.

    Read off calls bucketed at the cache TTL rather than off the gaps between
    them, which EAP cannot express: inside a bucket every call after the first
    has a predecessor closer than the TTL, and the first is charged as a cold
    start. Two calls a second apart on either side of a bucket boundary
    therefore read as two cold starts, which understates warmth -- the direction
    that costs a finding rather than inventing one.

    Bucket occupancy is a claim about spacing, and spacing is exactly what
    sampling erases: a bucket whose spans were all dropped is indistinguishable
    from one that saw no traffic. So a bucket is charged one cold start per
    stored span rather than one per bucket, which is the same thing when every
    span is stored and errs the same conservative way when they are not.
    """

    total_call_count: float
    warm_call_count: float

    @classmethod
    def from_buckets(cls, buckets: Iterable[WarmthBucket]) -> CallSiteWarmth:
        total_call_count = 0.0
        cold_starts = 0.0
        for bucket in buckets:
            if bucket.call_count <= 0:
                continue
            total_call_count += bucket.call_count
            # Each stored span is evidence of at most one cold start, and speaks
            # for the calls its bucket extrapolates it to. Unsampled that is the
            # single cold start a bucket's first call always is; sampled, the
            # calls it speaks for are charged as cold alongside it, because
            # nothing in the bucket says they arrived close enough to be warm.
            cold_starts += (
                bucket.call_count / bucket.sample_count
                if bucket.sample_count > 0
                else bucket.call_count
            )
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

    ``call_count`` is extrapolated to the traffic the call site really carries,
    which is the right number for how much a finding is worth. How far the
    evidence can be trusted is a different question, answered by
    ``sampled_call_count`` -- the spans actually stored, which every sum here
    was computed from.
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
    if (
        stats.avg_input_tokens < MIN_AVG_INPUT_TOKENS
        or stats.call_count < MIN_CALLS_FOR_CONFIDENCE
        or stats.sampled_call_count < MIN_SAMPLED_CALLS
    ):
        return CacheOutcome.INELIGIBLE

    creation_tokens = stats.sum_cache_creation_tokens
    # Thrash first: a call site paying the cache-write premium without
    # collecting reads is a more specific finding than a low hit rate.
    if (
        creation_tokens > 0
        and stats.hit_rate < THRASH_MAX_HIT_RATE
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


# A shared prefix only means something once two invocations have been compared.
MIN_PROMPT_SAMPLES = 2

# How much identical content has to sit on one side of the divergence before a
# prompt reads as misordered rather than merely variable: less than this shared
# up front, and at least this much stranded behind.
MIN_STABLE_BLOCK_CHARS = 256

# How much of a prompt to read around the point where the samples stop agreeing.
# What gets classified is the token straddling that point, and the longest of
# those is a hyphenated UUID at 36 characters, so this leaves room for a whole
# token either side of the boundary and little else.
DIVERGENCE_WINDOW_CHARS = 128

# What follows the divergence is compared in pieces rather than characters, so
# that an identical block still lines up when the variable text ahead of it
# changes length from one sample to the next. Line breaks put those cuts on
# content, which is what makes the alignment hold; a prompt carrying none is cut
# at fixed offsets instead, where a block that shifts is missed rather than
# misreported.
STABLE_BLOCK_SEGMENT_CHARS = 256


class DivergenceKind(StrEnum):
    """What sits at the point where a call site's sampled prompts stop agreeing."""

    NONE = "none"
    ISO_TIMESTAMP = "iso_timestamp"
    EPOCH_TIMESTAMP = "epoch_timestamp"
    UUID = "uuid"
    IDENTIFIER = "identifier"
    COUNTER = "counter"
    OTHER = "other"


# Ordered most specific first, since the first pattern covering the divergence
# point names it: everything built out of digits has to be tried before the bare
# run of digits that would otherwise swallow it.
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
    # Trace and span ids are 32 and 16 hex characters; shorter hex runs are left
    # to the counter pattern rather than guessed at. The prefixed alternative
    # covers the opaque ids APIs hand out, which nothing but the prefix makes
    # recognisable -- so a digit is required in the tail to keep ordinary
    # snake_case words from matching.
    (
        DivergenceKind.IDENTIFIER,
        re.compile(
            r"\b(?:[0-9a-f]{16,}"
            r"|(?:req|request|trace|span|session|conversation|thread|run|correlation)"
            r"[-_](?:id[-_])?(?=[0-9a-z]*\d)[0-9a-z]{6,})\b",
            re.IGNORECASE,
        ),
    ),
    # Epoch seconds and milliseconds for the next few centuries. Narrower than
    # "ten or thirteen digits" so that quantities of that size stay counters.
    (DivergenceKind.EPOCH_TIMESTAMP, re.compile(r"\b1\d{9}(?:\d{3})?\b")),
    (DivergenceKind.COUNTER, re.compile(r"\d+")),
)


@dataclass(frozen=True)
class PromptDivergence:
    """Where a call site's sampled prompts stop agreeing, and what sits there.

    A provider caches a prefix of the token sequence, so where the prompts stop
    agreeing is where caching stops being possible, whatever follows. Lengths
    are in characters: that is the unit the attribute is measured in, and
    converting to tokens would dress a tokenizer-dependent guess up as a count.

    ``stable_block_chars`` is a floor rather than a measurement. EAP truncates
    long attribute values, so a sampled prompt is a prefix of the real one --
    which leaves the shared prefix exact, since a divergence found inside the
    sample is a divergence in the prompt, but makes anything read from further
    in best-effort.

    No prompt text is carried out: only lengths, and the *kind* of the token the
    prompts part ways at.
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
        """Whether stable content is sitting behind the variable part.

        A cache holds a prefix and nothing else, so an identical block past the
        divergence is content that would have been cacheable had the template put
        it first, while what is shared ahead of the divergence is too little to
        be the point. The block does not have to clear a provider's minimum on
        its own: moved in front of the changing part it joins the prefix, and the
        ordering is what the finding is about.
        """
        return (
            self.common_prefix_chars < MIN_STABLE_BLOCK_CHARS
            and self.stable_block_chars >= MIN_STABLE_BLOCK_CHARS
        )


def _common_prefix_length(prompts: Sequence[str]) -> int:
    shortest = min(prompts, key=len)
    for index, character in enumerate(shortest):
        if any(prompt[index] != character for prompt in prompts):
            return index
    return len(shortest)


def _segment(text: str) -> list[str]:
    """Cut a prompt tail into pieces that can be aligned across samples.

    The attribute carries a serialized message list, so a newline inside a
    message arrives escaped rather than as the character itself; both forms are
    seams.
    """
    pieces = [piece for piece in re.split(r"(?<=\\n)|(?<=\n)", text) if piece]
    if len(pieces) > 1:
        return pieces
    return [
        text[offset : offset + STABLE_BLOCK_SEGMENT_CHARS]
        for offset in range(0, len(text), STABLE_BLOCK_SEGMENT_CHARS)
    ]


def _stable_block_chars(prompts: Sequence[str], *, start: int) -> int:
    """Size of the largest identical block every sample carries after ``start``.

    Not the shared tail: a prompt ends with whatever varies most, usually the
    user's own turn, so stable content stranded behind the divergence tends to
    sit in the middle with variable text on either side of it. All such content
    has in common is that it follows the divergence, so the largest identical
    run anywhere past that point is what gets measured.

    Reported conservatively when there are more than two samples: whichever
    pairing shares least is what is claimed, since a block missing from one
    sample is not a block the template always emits.
    """
    tails = [_segment(prompt[start:]) for prompt in prompts]
    reference = tails[0]
    shared: int | None = None
    for other in tails[1:]:
        # A stable block is made of repeated lines, which is exactly what the
        # junk heuristic would discard as too popular to be meaningful.
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
    """Name the token straddling the point where the prompts stop agreeing.

    Read from a window rather than the whole prompt, so that a pattern occurring
    somewhere else entirely cannot claim the divergence, and so the scan stays
    bounded on prompts tens of kilobytes long.
    """
    window_start = max(divergence_index - DIVERGENCE_WINDOW_CHARS, 0)
    window = prompt[window_start : divergence_index + DIVERGENCE_WINDOW_CHARS]
    boundary = divergence_index - window_start
    for kind, pattern in DIVERGENCE_PATTERNS:
        if any(match.start() <= boundary < match.end() for match in pattern.finditer(window)):
            return kind
    return DivergenceKind.OTHER


def diagnose_prompt_divergence(prompts: Sequence[str]) -> PromptDivergence | None:
    """Locate where one call site's sampled prompts stop agreeing.

    Returns None when there is nothing to compare. Sending prompt text is opt-in
    and usually off, so that is the ordinary outcome rather than a failure, and
    it leaves the rest of the finding to speak for itself.

    The prompts are compared as the SDK serialized them, which is a proxy for the
    token sequence a provider actually caches on -- close enough to say where a
    template starts varying, not close enough to quote as a token offset.
    """
    usable = [prompt for prompt in prompts if prompt]
    if len(usable) < MIN_PROMPT_SAMPLES:
        return None

    shortest_prompt_chars = min(len(prompt) for prompt in usable)
    common_prefix_chars = _common_prefix_length(usable)
    if common_prefix_chars >= shortest_prompt_chars:
        # The samples agree for as far as the shortest of them goes: a prompt
        # that only ever grows at the end, which is the shape a cache wants.
        # Nothing about the template explains the misses.
        return PromptDivergence(
            sample_count=len(usable),
            common_prefix_chars=common_prefix_chars,
            shortest_prompt_chars=shortest_prompt_chars,
            divergence_kind=DivergenceKind.NONE,
            stable_block_chars=0,
        )

    return PromptDivergence(
        sample_count=len(usable),
        common_prefix_chars=common_prefix_chars,
        shortest_prompt_chars=shortest_prompt_chars,
        # The samples disagree at the divergence -- that is what makes it one --
        # so reading any single one of them names that sample's version of the
        # token sitting there. Its value varies by definition; its shape is what
        # the template decides, and that is what gets reported.
        divergence_kind=_classify_divergence(usable[0], common_prefix_chars),
        stable_block_chars=_stable_block_chars(usable, start=common_prefix_chars),
    )
