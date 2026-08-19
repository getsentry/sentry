from __future__ import annotations

import pytest

from sentry.llm_cache_detection.detection import (
    MIN_AVG_INPUT_TOKENS,
    MIN_CACHEABLE_SHARE,
    MIN_CALLS_FOR_CONFIDENCE,
    AgentLabelSource,
    CacheFinding,
    CacheOutcome,
    CallSiteStats,
    CallSiteWarmth,
    classify_call_site,
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
) -> CallSiteStats:
    """Build stats from hit-rate and write:read ratios rather than raw token sums."""
    sum_input = call_count * avg_input_tokens
    sum_read = hit_rate * sum_input
    sum_creation = write_read_ratio * sum_read
    return CallSiteStats(
        agent_label=agent_label,
        agent_label_source=agent_label_source,
        span_name=span_name,
        model=model,
        call_count=call_count,
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
            make_stats(
                call_count=10_000, avg_input_tokens=2_000, hit_rate=0.2, write_read_ratio=2.0
            ),
            CacheOutcome.THRASH,
            id="thrash-ratio-inclusive-at-2",
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


def test_warmth_charges_one_cold_start_per_bucket() -> None:
    # Every call after the first in a bucket had a predecessor inside the TTL;
    # empty buckets are not cold starts because nothing was called in them.
    warmth = CallSiteWarmth.from_bucket_counts([5, 0, 3, 1, 0])

    assert warmth.total_call_count == 9
    assert warmth.warm_call_count == 6
    assert warmth.cacheable_share == pytest.approx(6 / 9)


def test_warmth_of_a_call_site_that_never_called() -> None:
    warmth = CallSiteWarmth.from_bucket_counts([0, 0])

    assert warmth.warm_call_count == 0
    assert warmth.cacheable_share == 0


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
