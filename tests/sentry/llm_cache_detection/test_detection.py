from __future__ import annotations

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
    DivergenceKind,
    WarmthBucket,
    classify_call_site,
    diagnose_prompt_divergence,
    find_contrast_anchor,
    needs_cache_presence_probe,
    resolve_with_cache_presence,
    resolve_with_warmth,
)


def make_stats(
    *,
    agent_label: str = "Some Agent",
    agent_label_source: AgentLabelSource = AgentLabelSource.AGENT_NAME,
    span_name: str = "generate_content generate_structured",
    model: str = "model-x",
    call_count: int,
    avg_input_tokens: float,
    hit_rate: float = 0.0,
    write_read_ratio: float = 0.0,
    sampled_call_count: int | None = None,
) -> CallSiteStats:
    """Build stats from hit-rate and write:read ratios rather than raw token sums.

    Defaults to every call being stored, so a case that says nothing about
    sampling reads as unsampled rather than as evidence-starved.
    """
    sum_input = call_count * avg_input_tokens
    sum_read = hit_rate * sum_input
    sum_creation = write_read_ratio * sum_read
    return CallSiteStats(
        agent_label=agent_label,
        agent_label_source=agent_label_source,
        span_name=span_name,
        model=model,
        call_count=call_count,
        sampled_call_count=call_count if sampled_call_count is None else sampled_call_count,
        sum_input_tokens=sum_input,
        sum_cache_read_tokens=sum_read,
        sum_cache_creation_tokens=sum_creation,
        avg_input_tokens=avg_input_tokens,
    )


@pytest.mark.parametrize(
    ("stats", "expected"),
    [
        pytest.param(
            # Healthy: high hit rate, modest write ratio.
            make_stats(
                call_count=660_000, avg_input_tokens=36_200, hit_rate=0.862, write_read_ratio=0.16
            ),
            CacheOutcome.HEALTHY,
            id="healthy-anthropic-86pct",
        ),
        pytest.param(
            # Healthy: high hit rate with no recorded cache writes.
            make_stats(call_count=21_000, avg_input_tokens=26_600, hit_rate=0.855),
            CacheOutcome.HEALTHY,
            id="healthy-gemini-855pct",
        ),
        pytest.param(
            # Healthy: hit rate at the low end of healthy usage, well above the cutoff.
            make_stats(call_count=14_600, avg_input_tokens=65_000, hit_rate=0.315),
            CacheOutcome.HEALTHY,
            id="healthy-lower-mode-315pct",
        ),
        pytest.param(
            # Not caching: near-zero hit rate at eligible volume.
            make_stats(call_count=169_000, avg_input_tokens=2_748, hit_rate=0.000088),
            CacheOutcome.NOT_CACHING,
            id="not-caching-gt-split-hypotheses",
        ),
        pytest.param(
            # Not caching: low but nonzero hit rate, still under the cutoff.
            make_stats(call_count=154_000, avg_input_tokens=20_474, hit_rate=0.0133),
            CacheOutcome.NOT_CACHING,
            id="not-caching-gt-filter-files",
        ),
        pytest.param(
            # Not caching: enormous volume, hit rate just under the cutoff.
            make_stats(call_count=22_750_000, avg_input_tokens=1_414, hit_rate=0.0221),
            CacheOutcome.NOT_CACHING,
            id="not-caching-proxy-flash-lite",
        ),
        pytest.param(
            # Thrash: cache writes vastly exceed reads at a low hit rate.
            make_stats(
                call_count=2_805, avg_input_tokens=5_401, hit_rate=0.086, write_read_ratio=10.7
            ),
            CacheOutcome.THRASH,
            id="thrash-sonnet-5-10.7x",
        ),
        pytest.param(
            # Ineligible: avg input below the cacheable minimum despite huge volume.
            make_stats(call_count=1_760_000, avg_input_tokens=452),
            CacheOutcome.INELIGIBLE,
            id="ineligible-avg-input-452",
        ),
        pytest.param(
            # Ineligible: avg input just under the cacheable minimum.
            make_stats(call_count=18_000, avg_input_tokens=1_003),
            CacheOutcome.INELIGIBLE,
            id="ineligible-avg-input-borderline-1003",
        ),
        pytest.param(
            # Ineligible: too few cache-eligible calls to read a ratio off.
            make_stats(call_count=120, avg_input_tokens=2_935, hit_rate=0.0025),
            CacheOutcome.INELIGIBLE,
            id="ineligible-below-the-confidence-floor",
        ),
        pytest.param(
            # Both floors met exactly.
            make_stats(call_count=MIN_CALLS_FOR_CONFIDENCE, avg_input_tokens=MIN_AVG_INPUT_TOKENS),
            CacheOutcome.NOT_CACHING,
            id="eligibility-thresholds-inclusive",
        ),
        pytest.param(
            # Sampling can clear the call floor on a handful of stored spans, and
            # the hit rate would then be read off that handful.
            make_stats(call_count=400_000, avg_input_tokens=8_000, sampled_call_count=4),
            CacheOutcome.INELIGIBLE,
            id="ineligible-call-floor-cleared-by-extrapolation",
        ),
        pytest.param(
            make_stats(
                call_count=400_000,
                avg_input_tokens=8_000,
                sampled_call_count=MIN_SAMPLED_CALLS,
            ),
            CacheOutcome.NOT_CACHING,
            id="sample-floor-inclusive",
        ),
        pytest.param(
            # A burst workload: dozens of calls inside a minute and then nothing
            # for hours. It averages far under one call per cache TTL across the
            # window, which says nothing about whether its cache stays warm.
            make_stats(call_count=600, avg_input_tokens=8_000),
            CacheOutcome.NOT_CACHING,
            id="bursty-traffic-is-evaluated",
        ),
        pytest.param(
            make_stats(call_count=10_000, avg_input_tokens=2_000, hit_rate=0.05),
            CacheOutcome.HEALTHY,
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
            CacheOutcome.THRASH,
            id="thrash-at-the-corner-of-both-gates",
        ),
        pytest.param(
            # Reading each written token back twice is a cache doing its job, so
            # the low hit rate is what a cold prefix costs rather than a defect.
            make_stats(
                call_count=10_000, avg_input_tokens=2_000, hit_rate=0.29, write_read_ratio=0.5
            ),
            CacheOutcome.HEALTHY,
            id="healthy-when-writes-are-amortised",
        ),
        pytest.param(
            # Ratio over threshold but hit rate at 30%: healthy usage, not thrash
            make_stats(
                call_count=10_000, avg_input_tokens=2_000, hit_rate=0.30, write_read_ratio=10.0
            ),
            CacheOutcome.HEALTHY,
            id="thrash-hit-rate-cutoff-exclusive-at-30pct",
        ),
        pytest.param(
            # Ratio 3:1 but writes are only ~29% of input: below the creation
            # fraction floor, so not thrash; hit 9.7% is above the 5% cutoff.
            make_stats(
                call_count=10_000, avg_input_tokens=2_000, hit_rate=0.097, write_read_ratio=3.0
            ),
            CacheOutcome.HEALTHY,
            id="thrash-creation-fraction-guard",
        ),
    ],
)
def test_classify_call_site(stats: CallSiteStats, expected: CacheOutcome) -> None:
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


def test_sampling_does_not_manufacture_warmth() -> None:
    # A call site making one call every TTL is cold on every one of them. Stored
    # at 10%, the calls that survive land one per bucket and each stands for the
    # ten the bucket extrapolates to -- all of which are cold too. Counting the
    # bucket once instead would read this as 90% cacheable, which is the sampling
    # rate wearing the shape of a verdict.
    warmth = CallSiteWarmth.from_buckets(
        [WarmthBucket(call_count=10, sample_count=1) for _ in range(200)]
    )

    assert warmth.total_call_count == 2_000
    assert warmth.warm_call_count == 0
    assert warmth.cacheable_share == 0


def test_sampling_understates_warmth_rather_than_inventing_it() -> None:
    # Genuinely dense traffic: 10 calls a bucket, 9 of them warm. Only 2 spans
    # per bucket are stored, which cannot show that, so warmth reads as half of
    # what it is. Wrong in the direction that costs a finding.
    warmth = CallSiteWarmth.from_buckets(
        [WarmthBucket(call_count=10, sample_count=2) for _ in range(200)]
    )

    assert warmth.total_call_count == 2_000
    assert warmth.cacheable_share == pytest.approx(0.5)
    assert warmth.cacheable_share < 0.9


def test_warmth_without_a_sample_count_claims_nothing() -> None:
    # A bucket that reports calls but no evidence of how many spans they came
    # from cannot say anything arrived close together.
    warmth = CallSiteWarmth.from_buckets([WarmthBucket(call_count=50, sample_count=0)])

    assert warmth.total_call_count == 50
    assert warmth.warm_call_count == 0


@pytest.mark.parametrize(
    ("warmth", "expected"),
    [
        pytest.param(
            CallSiteWarmth(total_call_count=50_000, warm_call_count=10_000),
            CacheOutcome.INELIGIBLE,
            id="mostly-isolated-calls",
        ),
        pytest.param(
            CallSiteWarmth(total_call_count=300, warm_call_count=MIN_CALLS_FOR_CONFIDENCE - 1),
            CacheOutcome.INELIGIBLE,
            id="too-few-calls-met-a-warm-cache",
        ),
        pytest.param(
            # Nothing is known about the gaps between this call site's calls,
            # which is as good as knowing they are too wide to cache.
            None,
            CacheOutcome.INELIGIBLE,
            id="warmth-never-measured",
        ),
        pytest.param(
            CallSiteWarmth(
                total_call_count=MIN_CALLS_FOR_CONFIDENCE / MIN_CACHEABLE_SHARE,
                warm_call_count=MIN_CALLS_FOR_CONFIDENCE,
            ),
            CacheOutcome.NOT_CACHING,
            id="both-floors-inclusive",
        ),
    ],
)
def test_resolve_with_warmth(warmth: CallSiteWarmth | None, expected: CacheOutcome) -> None:
    assert resolve_with_warmth(CacheOutcome.NOT_CACHING, warmth) == expected


def test_resolve_with_warmth_leaves_an_eligible_outcome_alone() -> None:
    # The resolver only ever rejects: it is not a second opinion on which of the
    # flagged readings a call site got.
    warmth = CallSiteWarmth(total_call_count=10_000, warm_call_count=9_000)

    assert resolve_with_warmth(CacheOutcome.THRASH, warmth) == CacheOutcome.THRASH


def test_web_search_wrapper_flags_without_gap_guard() -> None:
    # A wrapper path that emits no cache attributes at all looks like a
    # confident 0%-hit finding by sums alone and must be probed.
    stats = make_stats(
        span_name="generate_content anthropic_web_search",
        model="claude-haiku-4-5",
        call_count=62_553,
        avg_input_tokens=35_225,
    )
    outcome = classify_call_site(stats)
    assert outcome == CacheOutcome.NOT_CACHING
    assert needs_cache_presence_probe(stats, outcome) is True
    assert resolve_with_cache_presence(outcome, 0) == CacheOutcome.UNKNOWN


def test_gap_guard_skips_probe_for_positive_only_reporters() -> None:
    # Gemini records cache attributes only for positive values, so an eligible
    # group with wholly-absent attributes is a genuine 0% hit rate, not a gap.
    stats = make_stats(model="gemini-3.1-flash-lite", call_count=5_236_000, avg_input_tokens=2_866)
    outcome = classify_call_site(stats)
    assert outcome == CacheOutcome.NOT_CACHING
    assert needs_cache_presence_probe(stats, outcome) is False


@pytest.mark.parametrize(
    "model",
    ["o1", "o3-mini", "o4-mini", "openai/o3", "azure:o1-preview"],
    ids=lambda model: model,
)
def test_gap_guard_skips_probe_for_openai_reasoning_models(model: str) -> None:
    # The reasoning models go through the same OpenAI integration as the `gpt`
    # ones, which drops zero cache-token values before recording them, so their
    # absent attributes are a genuine 0% hit rate rather than a gap.
    stats = make_stats(model=model, call_count=62_553, avg_input_tokens=35_225)
    outcome = classify_call_site(stats)
    assert outcome == CacheOutcome.NOT_CACHING
    assert needs_cache_presence_probe(stats, outcome) is False


@pytest.mark.parametrize(
    "model",
    ["claude-opus-4-5", "claude-3-opus-20240229", "prod-o3-deployment", "mistral-large-2"],
    ids=lambda model: model,
)
def test_gap_guard_still_probes_models_outside_the_exemption(model: str) -> None:
    # Anthropic records real zeros, and an arbitrary deployment name says
    # nothing about which integration produced the span: both keep the guard.
    stats = make_stats(model=model, call_count=62_553, avg_input_tokens=35_225)
    outcome = classify_call_site(stats)
    assert outcome == CacheOutcome.NOT_CACHING
    assert needs_cache_presence_probe(stats, outcome) is True


def test_gap_guard_keeps_finding_when_attribute_is_recorded() -> None:
    stats = make_stats(call_count=62_553, avg_input_tokens=35_225)
    outcome = classify_call_site(stats)
    assert resolve_with_cache_presence(outcome, 1_484_483) == CacheOutcome.NOT_CACHING


def test_probe_not_needed_when_cache_activity_exists() -> None:
    stats = make_stats(call_count=169_000, avg_input_tokens=2_748, hit_rate=0.000088)
    outcome = classify_call_site(stats)
    assert outcome == CacheOutcome.NOT_CACHING
    assert needs_cache_presence_probe(stats, outcome) is False


def test_probe_not_needed_for_unflagged_outcomes() -> None:
    ineligible = make_stats(call_count=120, avg_input_tokens=2_935)
    assert needs_cache_presence_probe(ineligible, classify_call_site(ineligible)) is False

    healthy = make_stats(call_count=21_000, avg_input_tokens=26_600, hit_rate=0.855)
    assert needs_cache_presence_probe(healthy, classify_call_site(healthy)) is False


def test_find_contrast_anchor_same_model_high_hit_rate() -> None:
    # A healthy call site on the same model anchors the flagged one; a healthy
    # call site on a different model does not.
    flagged = make_stats(
        agent_label="PR Review",
        model="gemini-2.5-pro",
        call_count=169_000,
        avg_input_tokens=2_748,
        hit_rate=0.000088,
    )
    anchor_source = make_stats(
        agent_label="Explorer",
        span_name="generate_content gemini_generation",
        model="gemini-2.5-pro",
        call_count=21_000,
        avg_input_tokens=26_600,
        hit_rate=0.855,
    )
    other_model = make_stats(
        agent_label="Explorer",
        model="gemini-3-flash-preview",
        call_count=70_000,
        avg_input_tokens=15_600,
        hit_rate=0.526,
    )

    anchor = find_contrast_anchor(flagged, [flagged, anchor_source, other_model])

    assert anchor is not None
    assert anchor.model == "gemini-2.5-pro"
    assert anchor.agent_label == "Explorer"
    assert anchor.span_name == "generate_content gemini_generation"
    assert anchor.hit_rate == pytest.approx(0.855)


def test_find_contrast_anchor_prefers_highest_hit_rate() -> None:
    flagged = make_stats(model="gemini-2.5-pro", call_count=169_000, avg_input_tokens=2_748)
    lower = make_stats(
        agent_label="agent-a",
        model="gemini-2.5-pro",
        call_count=5_000,
        avg_input_tokens=2_000,
        hit_rate=0.6,
    )
    higher = make_stats(
        agent_label="agent-b",
        model="gemini-2.5-pro",
        call_count=5_000,
        avg_input_tokens=2_000,
        hit_rate=0.9,
    )

    anchor = find_contrast_anchor(flagged, [flagged, lower, higher])

    assert anchor is not None
    assert anchor.agent_label == "agent-b"
    assert anchor.hit_rate == pytest.approx(0.9)


def test_find_contrast_anchor_none_for_flash_lite() -> None:
    # No same-model call site clears the anchor hit-rate bar: no anchor.
    flagged = make_stats(
        agent_label="agent-a",
        model="gemini-2.5-flash-lite",
        call_count=22_750_000,
        avg_input_tokens=1_414,
        hit_rate=0.0221,
    )
    sibling = make_stats(
        agent_label="agent-b",
        model="gemini-2.5-flash-lite",
        call_count=1_180_000,
        avg_input_tokens=1_393,
        hit_rate=0.0011,
    )

    assert find_contrast_anchor(flagged, [flagged, sibling]) is None


def test_find_contrast_anchor_ignores_low_volume_candidates() -> None:
    flagged = make_stats(
        agent_label="agent-a", model="gemini-2.5-pro", call_count=169_000, avg_input_tokens=2_748
    )
    tiny_but_healthy = make_stats(
        agent_label="agent-b",
        model="gemini-2.5-pro",
        call_count=MIN_CALLS_FOR_CONFIDENCE - 1,
        avg_input_tokens=2_000,
        hit_rate=0.9,
    )

    assert find_contrast_anchor(flagged, [flagged, tiny_but_healthy]) is None


def test_find_contrast_anchor_ignores_own_group() -> None:
    healthy = make_stats(call_count=21_000, avg_input_tokens=26_600, hit_rate=0.855)

    assert find_contrast_anchor(healthy, [healthy]) is None


def test_uncached_tokens() -> None:
    stats = CallSiteStats(
        agent_label="a",
        agent_label_source=AgentLabelSource.AGENT_NAME,
        span_name="s",
        model="m",
        call_count=10_000,
        sampled_call_count=10_000,
        sum_input_tokens=1_000_000,
        sum_cache_read_tokens=100_000,
        sum_cache_creation_tokens=50_000,
        avg_input_tokens=100,
    )
    assert stats.uncached_tokens == 850_000
    assert stats.unrecouped_cache_write_tokens == 0


def test_uncached_tokens_floors_at_zero() -> None:
    # Cache reads plus writes can exceed input tokens, so the subtraction goes
    # negative and must clamp.
    stats = make_stats(
        call_count=2_805, avg_input_tokens=5_401, hit_rate=0.086, write_read_ratio=10.7
    )
    assert stats.uncached_tokens == 0


def test_unrecouped_cache_write_tokens() -> None:
    stats = CallSiteStats(
        agent_label="a",
        agent_label_source=AgentLabelSource.AGENT_NAME,
        span_name="s",
        model="m",
        call_count=10_000,
        sampled_call_count=10_000,
        sum_input_tokens=1_000_000,
        sum_cache_read_tokens=100_000,
        sum_cache_creation_tokens=150_000,
        avg_input_tokens=100,
    )
    assert stats.unrecouped_cache_write_tokens == 50_000


def test_severity_ranks_thrash_above_small_not_caching() -> None:
    # A thrash group burns tokens as un-recouped cache writes rather than
    # uncached input, so severity must count both or thrash always sorts last.
    thrash = CacheFinding(
        outcome=CacheOutcome.THRASH,
        stats=make_stats(
            call_count=2_805, avg_input_tokens=5_401, hit_rate=0.086, write_read_ratio=10.7
        ),
        anchor=None,
    )
    small_not_caching = CacheFinding(
        outcome=CacheOutcome.NOT_CACHING,
        stats=make_stats(call_count=2_000, avg_input_tokens=1_500),
        anchor=None,
    )

    assert thrash.stats.uncached_tokens == 0
    assert thrash.severity > small_not_caching.severity


def test_hit_rate_and_ratio_handle_zero_denominators() -> None:
    stats = make_stats(call_count=0, avg_input_tokens=0)
    assert stats.hit_rate == 0.0
    assert stats.write_read_ratio is None


# Every prompt in these tests is invented. Real prompt text never enters a
# fixture: the detector only ever reports lengths and a kind, and the tests hold
# themselves to the same line.
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
    ],
)
def test_names_what_the_samples_first_differ_at(
    first_head: str, second_head: str, expected: DivergenceKind
) -> None:
    divergence = diagnose_prompt_divergence([make_prompt(first_head), make_prompt(second_head)])

    assert divergence is not None
    assert divergence.divergence_kind is expected


def test_a_word_that_reads_like_an_id_prefix_is_not_one() -> None:
    # The prefixed-id pattern is only recognisable by its prefix, so it demands a
    # digit in the tail rather than claiming every `run_`-prefixed word.
    divergence = diagnose_prompt_divergence(
        [make_prompt("Step run_migrations. "), make_prompt("Step run_backfills. ")]
    )

    assert divergence is not None
    assert divergence.divergence_kind is DivergenceKind.OTHER


def test_flags_a_template_holding_its_stable_content_behind_the_variable_part() -> None:
    divergence = diagnose_prompt_divergence(
        [make_prompt("Now: 2026-08-19T10:15:00Z. "), make_prompt("Now: 2026-08-19T11:47:31Z. ")]
    )

    assert divergence is not None
    assert divergence.common_prefix_chars < MIN_STABLE_BLOCK_CHARS
    assert divergence.stable_block_chars >= MIN_STABLE_BLOCK_CHARS
    assert divergence.template_misordered


def test_does_not_call_it_misordered_when_the_stable_content_already_comes_first() -> None:
    # The stable content is in front of the divergence, which is where a cache
    # reads from; that the tail varies after it is ordinary, not a template
    # someone put together backwards.
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
    # A block does not have to clear a provider's minimum by itself to be worth
    # moving, because ahead of the changing part it joins the prefix rather than
    # standing alone.
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
    # The shape a template usually breaks in: something variable up front, the
    # stable body behind it, and the caller's own text last -- so the content
    # worth moving is neither the prefix nor the suffix. The heads differ in
    # length, so the block sits at a different offset in each sample and can
    # only be found by aligning on content.
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
