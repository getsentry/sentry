from __future__ import annotations

from dataclasses import replace

import pytest

from sentry.llm_cache_detection.detection import (
    MIN_AVG_INPUT_TOKENS,
    MIN_CACHEABLE_SHARE,
    MIN_CALLS_FOR_CONFIDENCE,
    MIN_SAMPLED_CALLS,
    MIN_STABLE_BLOCK_CHARS,
    AgentLabelSource,
    CacheFinding,
    CacheOutcome,
    CallSiteStats,
    CallSiteWarmth,
    Classification,
    ContrastAnchor,
    DivergenceKind,
    OutcomeReason,
    ProbeGap,
    WarmthBucket,
    classify_call_site,
    diagnose_prompt_divergence,
    find_contrast_anchor,
    resolve_with_cache_presence,
    resolve_with_warmth,
)
from tests.sentry.llm_cache_detection.test_utils import make_stats


@pytest.mark.parametrize(
    ("stats", "expected"),
    [
        pytest.param(
            # Healthy: high hit rate, modest write ratio.
            make_stats(
                call_count=50_000, avg_input_tokens=20_000, hit_rate=0.85, write_read_ratio=0.15
            ),
            Classification(CacheOutcome.HEALTHY, OutcomeReason.CACHE_ACTIVITY),
            id="healthy-high-hit-rate",
        ),
        pytest.param(
            # Healthy: hit rate at the low end of healthy usage, well above the cutoff.
            make_stats(call_count=10_000, avg_input_tokens=50_000, hit_rate=0.3),
            Classification(CacheOutcome.HEALTHY, OutcomeReason.CACHE_ACTIVITY),
            id="healthy-low-hit-rate",
        ),
        pytest.param(
            # Not caching: near-zero hit rate at eligible volume.
            make_stats(call_count=100_000, avg_input_tokens=3_000, hit_rate=0.0001),
            Classification(CacheOutcome.NOT_CACHING, OutcomeReason.CACHE_ACTIVITY),
            id="not-caching-near-zero-hit-rate",
        ),
        pytest.param(
            # Thrash: cache writes vastly exceed reads at a low hit rate.
            make_stats(
                call_count=3_000, avg_input_tokens=5_000, hit_rate=0.08, write_read_ratio=12.0
            ),
            Classification(CacheOutcome.THRASH, OutcomeReason.CACHE_ACTIVITY),
            id="thrash-writes-far-outrun-reads",
        ),
        pytest.param(
            # Ineligible: avg input just under the cacheable minimum.
            make_stats(call_count=20_000, avg_input_tokens=MIN_AVG_INPUT_TOKENS - 1),
            Classification(CacheOutcome.INELIGIBLE, OutcomeReason.SMALL_PROMPTS),
            id="ineligible-avg-input-just-under-the-minimum",
        ),
        pytest.param(
            # Ineligible: too few cache-eligible calls to read a ratio off.
            make_stats(call_count=100, avg_input_tokens=3_000, hit_rate=0.0025),
            Classification(CacheOutcome.INELIGIBLE, OutcomeReason.LOW_VOLUME),
            id="ineligible-below-the-confidence-floor",
        ),
        pytest.param(
            # Both floors met exactly.
            make_stats(call_count=MIN_CALLS_FOR_CONFIDENCE, avg_input_tokens=MIN_AVG_INPUT_TOKENS),
            Classification(CacheOutcome.NOT_CACHING, OutcomeReason.ZERO_CACHE_TOKENS),
            id="eligibility-thresholds-inclusive",
        ),
        pytest.param(
            # Sampling can clear the call floor on a handful of stored spans, and
            # the hit rate would then be read off that handful.
            make_stats(call_count=400_000, avg_input_tokens=8_000, sampled_call_count=4),
            Classification(CacheOutcome.INELIGIBLE, OutcomeReason.FEW_STORED_SPANS),
            id="ineligible-call-floor-cleared-by-extrapolation",
        ),
        pytest.param(
            make_stats(
                call_count=400_000,
                avg_input_tokens=8_000,
                sampled_call_count=MIN_SAMPLED_CALLS,
            ),
            Classification(CacheOutcome.NOT_CACHING, OutcomeReason.ZERO_CACHE_TOKENS),
            id="sample-floor-inclusive",
        ),
        pytest.param(
            # Bursty traffic averages under one call per TTL yet can stay warm.
            make_stats(call_count=600, avg_input_tokens=8_000),
            Classification(CacheOutcome.NOT_CACHING, OutcomeReason.ZERO_CACHE_TOKENS),
            id="bursty-traffic-is-evaluated",
        ),
        pytest.param(
            make_stats(call_count=10_000, avg_input_tokens=2_000, hit_rate=0.05),
            Classification(CacheOutcome.HEALTHY, OutcomeReason.CACHE_ACTIVITY),
            id="hit-rate-cutoff-exclusive-at-5pct",
        ),
        pytest.param(
            # Writes at 30% of input against a 29% hit rate: the tightest shape
            # the two gates admit, and the ratio it implies is barely over 1:1.
            make_stats(
                call_count=10_000,
                avg_input_tokens=2_000,
                hit_rate=0.29,
                write_read_ratio=0.3 / 0.29,
            ),
            Classification(CacheOutcome.THRASH, OutcomeReason.CACHE_ACTIVITY),
            id="thrash-at-the-corner-of-both-gates",
        ),
        pytest.param(
            # Reading each written token back twice is a cache doing its job, so
            # the low hit rate is what a cold prefix costs rather than a defect.
            make_stats(
                call_count=10_000, avg_input_tokens=2_000, hit_rate=0.29, write_read_ratio=0.5
            ),
            Classification(CacheOutcome.HEALTHY, OutcomeReason.CACHE_ACTIVITY),
            id="healthy-when-writes-are-amortised",
        ),
        pytest.param(
            # Ratio over threshold but hit rate at 30%: healthy usage, not thrash
            make_stats(
                call_count=10_000, avg_input_tokens=2_000, hit_rate=0.30, write_read_ratio=10.0
            ),
            Classification(CacheOutcome.HEALTHY, OutcomeReason.CACHE_ACTIVITY),
            id="thrash-hit-rate-cutoff-exclusive-at-30pct",
        ),
        pytest.param(
            # Ratio 3:1 but writes are only ~29% of input: below the creation
            # fraction floor, so not thrash; hit 9.7% is above the 5% cutoff.
            make_stats(
                call_count=10_000, avg_input_tokens=2_000, hit_rate=0.097, write_read_ratio=3.0
            ),
            Classification(CacheOutcome.HEALTHY, OutcomeReason.CACHE_ACTIVITY),
            id="thrash-creation-fraction-guard",
        ),
    ],
)
def test_classify_call_site(stats: CallSiteStats, expected: Classification) -> None:
    assert classify_call_site(stats) == expected


def unsampled(*call_counts: float) -> list[WarmthBucket]:
    """Buckets from a project storing every span, where count and evidence agree."""
    return [WarmthBucket(call_count=count, sample_count=count) for count in call_counts]


def test_warmth_charges_one_cold_start_per_bucket() -> None:
    # Every call after the first in a bucket had a predecessor inside the TTL;
    # empty buckets are not cold starts because nothing was called in them.
    warmth = CallSiteWarmth.from_buckets(unsampled(5, 0, 3, 1, 0))

    assert warmth.total_call_count == 9
    assert warmth.warm_call_count == 6
    assert warmth.cacheable_share == pytest.approx(6 / 9)


def test_warmth_of_a_call_site_that_never_called() -> None:
    warmth = CallSiteWarmth.from_buckets(unsampled(0, 0))

    assert warmth.warm_call_count == 0
    assert warmth.cacheable_share == 0


@pytest.mark.parametrize(
    ("sample_count", "cacheable_share"),
    [
        # One call per TTL, stored at 10%: counting each bucket once would read
        # the sampling rate as 90% cacheable.
        pytest.param(1, 0.0, id="sampling-does-not-manufacture-warmth"),
        # 9 of 10 calls a bucket are warm, but 2 stored spans can only show half.
        pytest.param(2, 0.5, id="sampling-understates-warmth"),
        # Calls with no evidence of how many spans they came from cannot be
        # shown to have arrived close together.
        pytest.param(0, 0.0, id="no-sample-count-claims-nothing"),
    ],
)
def test_warmth_charges_each_stored_span_as_a_cold_start(
    sample_count: int, cacheable_share: float
) -> None:
    warmth = CallSiteWarmth.from_buckets(
        [WarmthBucket(call_count=10, sample_count=sample_count) for _ in range(200)]
    )

    assert warmth.total_call_count == 2_000
    assert warmth.cacheable_share == pytest.approx(cacheable_share)


NOT_CACHING = Classification(CacheOutcome.NOT_CACHING, OutcomeReason.CACHE_ACTIVITY)


@pytest.mark.parametrize(
    ("warmth", "expected"),
    [
        pytest.param(
            CallSiteWarmth(total_call_count=50_000, warm_call_count=10_000),
            Classification(CacheOutcome.INELIGIBLE, OutcomeReason.LOW_CACHEABLE_SHARE),
            id="mostly-isolated-calls",
        ),
        pytest.param(
            CallSiteWarmth(total_call_count=300, warm_call_count=MIN_CALLS_FOR_CONFIDENCE - 1),
            Classification(CacheOutcome.INELIGIBLE, OutcomeReason.TOO_FEW_WARM_CALLS),
            id="too-few-calls-met-a-warm-cache",
        ),
        # Nothing is known about the gaps between these call sites' calls, which
        # is as good as knowing they are too wide to cache -- but each says why.
        pytest.param(
            ProbeGap.BUDGET_EXHAUSTED,
            Classification(CacheOutcome.INELIGIBLE, OutcomeReason.BUDGET_EXHAUSTED),
            id="warmth-budget-spent",
        ),
        pytest.param(
            ProbeGap.UNQUERYABLE,
            Classification(CacheOutcome.INELIGIBLE, OutcomeReason.UNQUERYABLE_CALL_SITE),
            id="warmth-unqueryable",
        ),
        pytest.param(
            ProbeGap.FAILED,
            Classification(CacheOutcome.INELIGIBLE, OutcomeReason.PROBE_FAILED),
            id="warmth-query-failed",
        ),
        pytest.param(
            CallSiteWarmth(
                total_call_count=MIN_CALLS_FOR_CONFIDENCE / MIN_CACHEABLE_SHARE,
                warm_call_count=MIN_CALLS_FOR_CONFIDENCE,
            ),
            NOT_CACHING,
            id="both-floors-inclusive",
        ),
    ],
)
def test_resolve_with_warmth(warmth: CallSiteWarmth | ProbeGap, expected: Classification) -> None:
    assert resolve_with_warmth(NOT_CACHING, warmth) == expected


@pytest.mark.parametrize(
    ("model", "reason"),
    [
        # Instrumentation that records cache tokens only when positive, so
        # absent attributes are a genuine 0% hit rate rather than a gap.
        ("gemini-3.1-flash-lite", OutcomeReason.POSITIVE_ONLY_REPORTER),
        ("gpt-4o-mini", OutcomeReason.POSITIVE_ONLY_REPORTER),
        # The same OpenAI integration as `gpt`.
        ("o1", OutcomeReason.POSITIVE_ONLY_REPORTER),
        ("o3-mini", OutcomeReason.POSITIVE_ONLY_REPORTER),
        ("o4-mini", OutcomeReason.POSITIVE_ONLY_REPORTER),
        ("openai/o3", OutcomeReason.POSITIVE_ONLY_REPORTER),
        ("azure:o1-preview", OutcomeReason.POSITIVE_ONLY_REPORTER),
        # Anthropic records real zeros, and an arbitrary deployment name says
        # nothing about which integration produced the span: both leave it to
        # the presence probe.
        ("claude-opus-4-5", OutcomeReason.ZERO_CACHE_TOKENS),
        ("claude-3-opus-20240229", OutcomeReason.ZERO_CACHE_TOKENS),
        ("prod-o3-deployment", OutcomeReason.ZERO_CACHE_TOKENS),
        ("mistral-large-2", OutcomeReason.ZERO_CACHE_TOKENS),
    ],
)
def test_zero_cache_tokens_are_ambiguous_unless_the_model_omits_zeros(
    model: str, reason: OutcomeReason
) -> None:
    stats = make_stats(model=model, call_count=50_000, avg_input_tokens=30_000)

    assert classify_call_site(stats) == Classification(CacheOutcome.NOT_CACHING, reason)


AMBIGUOUS_ZERO = Classification(CacheOutcome.NOT_CACHING, OutcomeReason.ZERO_CACHE_TOKENS)


@pytest.mark.parametrize(
    ("spans_with_cache_attributes", "expected"),
    [
        # A wrapper path that emits no cache attributes at all.
        pytest.param(
            0,
            Classification(CacheOutcome.UNKNOWN, OutcomeReason.NO_CACHE_ATTRIBUTES),
            id="attributes-never-recorded",
        ),
        pytest.param(
            500,
            Classification(CacheOutcome.NOT_CACHING, OutcomeReason.EXPLICIT_ZERO_CACHE_TOKENS),
            id="explicit-zeros-recorded",
        ),
        pytest.param(
            ProbeGap.BUDGET_EXHAUSTED,
            Classification(CacheOutcome.UNKNOWN, OutcomeReason.BUDGET_EXHAUSTED),
            id="presence-budget-spent",
        ),
        pytest.param(
            ProbeGap.UNQUERYABLE,
            Classification(CacheOutcome.UNKNOWN, OutcomeReason.UNQUERYABLE_CALL_SITE),
            id="presence-unqueryable",
        ),
        pytest.param(
            ProbeGap.FAILED,
            Classification(CacheOutcome.UNKNOWN, OutcomeReason.PROBE_FAILED),
            id="presence-query-failed",
        ),
    ],
)
def test_resolve_with_cache_presence(
    spans_with_cache_attributes: int | ProbeGap, expected: Classification
) -> None:
    assert resolve_with_cache_presence(AMBIGUOUS_ZERO, spans_with_cache_attributes) == expected


ANCHOR_MODEL = "gemini-2.5-pro"
FLAGGED = make_stats(model=ANCHOR_MODEL, call_count=100_000, avg_input_tokens=3_000)


def healthy_sibling(
    *,
    agent_label: str = "Researcher",
    model: str = ANCHOR_MODEL,
    call_count: int = 5_000,
    hit_rate: float = 0.9,
) -> CallSiteStats:
    """A call site beside ``FLAGGED`` that anchors it unless a default is overridden."""
    return make_stats(
        agent_label=agent_label,
        model=model,
        call_count=call_count,
        avg_input_tokens=2_000,
        hit_rate=hit_rate,
    )


def test_find_contrast_anchor_picks_the_best_same_model_call_site() -> None:
    best = healthy_sibling(agent_label="Researcher", hit_rate=0.9)

    anchor = find_contrast_anchor(
        FLAGGED, [FLAGGED, healthy_sibling(agent_label="Planner", hit_rate=0.6), best]
    )

    assert anchor == ContrastAnchor(
        agent_label="Researcher",
        agent_label_source=AgentLabelSource.AGENT_NAME,
        span_name=best.span_name,
        model=ANCHOR_MODEL,
        hit_rate=best.hit_rate,
        call_count=best.call_count,
        avg_input_tokens=best.avg_input_tokens,
    )


@pytest.mark.parametrize(
    "sibling",
    [
        pytest.param(healthy_sibling(model="gemini-3-flash-preview"), id="other-model"),
        pytest.param(healthy_sibling(hit_rate=0.3), id="hit-rate-below-the-bar"),
        pytest.param(healthy_sibling(call_count=MIN_CALLS_FOR_CONFIDENCE - 1), id="too-few-calls"),
        pytest.param(healthy_sibling(agent_label=FLAGGED.agent_label), id="own-call-site"),
    ],
)
def test_find_contrast_anchor_needs_a_healthy_call_site_elsewhere_on_the_model(
    sibling: CallSiteStats,
) -> None:
    assert find_contrast_anchor(FLAGGED, [FLAGGED, sibling]) is None


def with_token_sums(
    *, input_tokens: float, cache_read_tokens: float, cache_creation_tokens: float
) -> CallSiteStats:
    return replace(
        make_stats(),
        sum_input_tokens=input_tokens,
        sum_cache_read_tokens=cache_read_tokens,
        sum_cache_creation_tokens=cache_creation_tokens,
    )


@pytest.mark.parametrize(
    ("cache_read_tokens", "cache_creation_tokens", "uncached", "unrecouped_writes"),
    [
        pytest.param(100_000, 50_000, 850_000, 0, id="reads-recoup-the-writes"),
        pytest.param(100_000, 150_000, 750_000, 50_000, id="writes-outrun-the-reads"),
        # Input reported exclusive of cached tokens takes the subtraction negative.
        pytest.param(200_000, 900_000, 0, 700_000, id="uncached-floors-at-zero"),
    ],
)
def test_splits_input_by_what_the_cache_did_with_it(
    cache_read_tokens: float,
    cache_creation_tokens: float,
    uncached: float,
    unrecouped_writes: float,
) -> None:
    stats = with_token_sums(
        input_tokens=1_000_000,
        cache_read_tokens=cache_read_tokens,
        cache_creation_tokens=cache_creation_tokens,
    )

    assert stats.uncached_tokens == uncached
    assert stats.unrecouped_cache_write_tokens == unrecouped_writes


@pytest.mark.parametrize(
    ("input_tokens", "cache_read_tokens", "cache_creation_tokens", "exceeds"),
    [
        pytest.param(1_000_000, 200_000, 900_000, True, id="input-reported-exclusive-of-cache"),
        # Fully cached input, which extrapolated sums can land a rounding error
        # above the input it belongs to.
        pytest.param(300_000.3, 100_000.1, 200_000.2, False, id="fully-cached-input"),
    ],
)
def test_flags_cache_tokens_exceeding_the_input_they_belong_to(
    input_tokens: float, cache_read_tokens: float, cache_creation_tokens: float, exceeds: bool
) -> None:
    stats = with_token_sums(
        input_tokens=input_tokens,
        cache_read_tokens=cache_read_tokens,
        cache_creation_tokens=cache_creation_tokens,
    )

    assert stats.sum_cache_read_tokens + stats.sum_cache_creation_tokens > stats.sum_input_tokens
    assert stats.cache_exceeds_input is exceeds


def test_severity_ranks_thrash_above_small_not_caching() -> None:
    # A thrash group burns tokens as un-recouped cache writes rather than
    # uncached input, so severity must count both or thrash always sorts last.
    thrash = CacheFinding(
        classification=Classification(CacheOutcome.THRASH, OutcomeReason.CACHE_ACTIVITY),
        stats=make_stats(
            call_count=3_000, avg_input_tokens=5_000, hit_rate=0.08, write_read_ratio=12.0
        ),
        anchor=None,
    )
    small_not_caching = CacheFinding(
        classification=Classification(CacheOutcome.NOT_CACHING, OutcomeReason.ZERO_CACHE_TOKENS),
        stats=make_stats(call_count=2_000, avg_input_tokens=1_500),
        anchor=None,
    )

    assert thrash.stats.uncached_tokens == 0
    assert thrash.severity > small_not_caching.severity


def test_hit_rate_and_ratio_handle_zero_denominators() -> None:
    stats = make_stats(call_count=0, avg_input_tokens=0)
    assert stats.hit_rate == 0.0
    assert stats.write_read_ratio is None


# Every prompt in these tests is invented; real prompt text never enters a fixture.
STABLE_BLOCK = "Rank the candidate rows and explain the ranking briefly.\n" * 200
SHORT_BLOCK = "Answer in one sentence.\n"
MESSAGE_LIST_OPENING = '[{"role": "system", "content": "'


def make_prompt(head: str, body: str = STABLE_BLOCK, tail: str = "") -> str:
    """A serialized message list with a variable head and a stable body."""
    return f'{MESSAGE_LIST_OPENING}{head}{body}{tail}"}}]'


@pytest.mark.parametrize(
    "prompts",
    [
        pytest.param([], id="nothing-sampled"),
        pytest.param([make_prompt("")], id="one-invocation-has-nothing-to-differ-from"),
        pytest.param(["", ""], id="spans-carrying-an-empty-attribute"),
        pytest.param([make_prompt(""), ""], id="only-one-of-the-samples-carries-text"),
    ],
)
def test_no_diagnosis_without_two_prompts_to_compare(prompts: list[str]) -> None:
    assert diagnose_prompt_divergence(prompts) is None


def test_reports_no_divergence_when_the_samples_agree() -> None:
    # A prompt that only ever grows at the end is the shape a cache wants, so
    # nothing about the template explains the misses.
    prompt = make_prompt("")
    divergence = diagnose_prompt_divergence([prompt, prompt + " and then some more."])

    assert divergence is not None
    assert divergence.divergence_kind is DivergenceKind.NONE
    assert divergence.common_prefix_chars == len(prompt)
    assert divergence.prefix_share == 1.0
    assert divergence.stable_block_chars == 0
    assert not divergence.template_misordered


def test_measures_the_prefix_the_samples_share() -> None:
    head = "Reviewer "
    divergence = diagnose_prompt_divergence(
        [
            make_prompt(f"{head}alpha. "),
            make_prompt(f"{head}bravo. "),
            make_prompt(f"{head}gamma. "),
        ]
    )

    assert divergence is not None
    assert divergence.sample_count == 3
    assert divergence.common_prefix_chars == len(MESSAGE_LIST_OPENING) + len(head)
    assert divergence.shortest_prompt_chars == len(make_prompt(f"{head}alpha. "))
    assert divergence.prefix_share == pytest.approx(
        divergence.common_prefix_chars / divergence.shortest_prompt_chars
    )


@pytest.mark.parametrize(
    ("first_head", "second_head", "expected"),
    [
        pytest.param(
            "Now: 2026-08-19T10:15:00Z. ",
            "Now: 2026-08-19T11:47:31Z. ",
            DivergenceKind.ISO_TIMESTAMP,
            id="iso-timestamp",
        ),
        pytest.param(
            "Now: 1755600000123. ",
            "Now: 1755600991777. ",
            DivergenceKind.EPOCH_TIMESTAMP,
            id="epoch-millis",
        ),
        pytest.param(
            "Session 0f2b7a1c-1c3e-4b6a-9f2d-8a1b2c3d4e5f. ",
            "Session 0f2b7a1c-1c3e-4b6a-9f2d-8a1b2c3d4e60. ",
            DivergenceKind.UUID,
            id="uuid",
        ),
        pytest.param(
            "Trace 9f2d8a1b2c3d4e5f9f2d8a1b2c3d4e5f. ",
            "Trace 9f2d8a1b2c3d4e5f9f2d8a1b2c3d4e60. ",
            DivergenceKind.IDENTIFIER,
            id="hex-trace-id",
        ),
        pytest.param(
            "Call req_a1b2c3d4e5. ",
            "Call req_a1b2c3d4f7. ",
            DivergenceKind.IDENTIFIER,
            id="prefixed-opaque-id",
        ),
        pytest.param(
            "Turn 41 of this session. ",
            "Turn 42 of this session. ",
            DivergenceKind.COUNTER,
            id="counter",
        ),
        pytest.param(
            "The user asked about pears. ",
            "The user asked about apples. ",
            DivergenceKind.OTHER,
            id="ordinary-varying-text",
        ),
        # The prefixed-id pattern is only recognisable by its prefix, so it
        # demands a digit in the tail rather than claiming every `run_` word.
        pytest.param(
            "Step run_migrations. ",
            "Step run_backfills. ",
            DivergenceKind.OTHER,
            id="word-that-reads-like-an-id-prefix",
        ),
    ],
)
def test_names_what_the_samples_first_differ_at(
    first_head: str, second_head: str, expected: DivergenceKind
) -> None:
    divergence = diagnose_prompt_divergence([make_prompt(first_head), make_prompt(second_head)])

    assert divergence is not None
    assert divergence.divergence_kind is expected


def test_does_not_call_it_misordered_when_the_stable_content_already_comes_first() -> None:
    # Stable content up front, variable tail: the shape a cache wants.
    shared = "A" * (MIN_STABLE_BLOCK_CHARS + 1)
    divergence = diagnose_prompt_divergence(
        [f"{shared}{STABLE_BLOCK}pears", f"{shared}{STABLE_BLOCK}apples"]
    )

    assert divergence is not None
    assert divergence.common_prefix_chars > MIN_STABLE_BLOCK_CHARS
    assert not divergence.template_misordered


def test_does_not_call_it_misordered_when_too_little_follows_the_divergence() -> None:
    # A block this small is not worth rewriting a template over, whatever it
    # would add to the prefix, so there is nothing to recommend.
    divergence = diagnose_prompt_divergence(
        [
            make_prompt("Now: 2026-08-19T10:15:00Z. ", SHORT_BLOCK),
            make_prompt("Now: 2026-08-19T11:47:31Z. ", SHORT_BLOCK),
        ]
    )

    assert divergence is not None
    assert 0 < divergence.stable_block_chars < MIN_STABLE_BLOCK_CHARS
    assert not divergence.template_misordered


def test_flags_a_stranded_block_too_small_to_have_cached_on_its_own() -> None:
    # Moved ahead of the changing part, a small block joins the prefix.
    modest_block = "Rank the candidate rows and explain the ranking briefly.\n" * 8
    divergence = diagnose_prompt_divergence(
        [
            make_prompt("Now: 2026-08-19T10:15:00Z. ", modest_block),
            make_prompt("Now: 2026-08-19T11:47:31Z. ", modest_block),
        ]
    )

    assert divergence is not None
    # A few hundred characters is nowhere near the thousand-odd tokens a provider
    # asks of a prefix, and the template still reads as misordered.
    assert MIN_STABLE_BLOCK_CHARS <= divergence.stable_block_chars < 1_000
    assert divergence.template_misordered


def test_finds_stable_content_stranded_between_two_variable_parts() -> None:
    # Variable head, stable body, caller's text last; heads of different lengths
    # put the body at different offsets, so it is found by aligning on content.
    divergence = diagnose_prompt_divergence(
        [
            make_prompt("Session 41. ", tail="how do I rotate a key?"),
            make_prompt("Session 7. ", tail="why did the job fail?"),
        ]
    )

    assert divergence is not None
    assert divergence.common_prefix_chars < MIN_STABLE_BLOCK_CHARS
    assert divergence.stable_block_chars >= MIN_STABLE_BLOCK_CHARS
    assert divergence.template_misordered


def test_the_stable_block_does_not_reach_back_past_the_divergence() -> None:
    # Only what follows the divergence is measured, so content shared in the
    # prefix cannot be counted a second time as a block worth moving.
    shared_prefix = "Rank the rows and explain the ranking.\n" * 200
    divergence = diagnose_prompt_divergence([f"{shared_prefix}alpha", f"{shared_prefix}beta"])

    assert divergence is not None
    assert divergence.common_prefix_chars == len(shared_prefix)
    assert divergence.stable_block_chars == 0
