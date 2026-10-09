from __future__ import annotations

from dataclasses import replace
from datetime import timedelta

import pytest

from sentry.ai_monitoring.issues.llm_cache_detection.detection import (
    CACHE_TTL_MINUTES,
    DEFAULT_MIN_CACHEABLE_PREFIX_TOKENS,
    DETECTION_WINDOW_DAYS,
    MIN_CALLS_FOR_CONFIDENCE,
    MIN_SAMPLED_CALLS,
    AgentLabelSource,
    CacheFinding,
    CacheOutcome,
    CallSiteStats,
    CallSiteWarmth,
    Classification,
    DetectionWindow,
    OutcomeReason,
    ProbeGap,
    WarmthBucket,
    classify_call_site,
    min_cacheable_prefix_tokens,
    resolve_with_cache_presence,
    resolve_with_warmth,
)


def make_stats() -> CallSiteStats:
    return CallSiteStats(
        agent_label="Reviewer",
        agent_label_source=AgentLabelSource.AGENT_NAME,
        span_name="generate_content",
        model="model-x",
        call_count=1_000,
        sampled_call_count=500,
        sum_input_tokens=1_000_000,
        sum_cache_read_tokens=100_000,
        sum_cache_creation_tokens=150_000,
        avg_input_tokens=2_000,
    )


def test_detection_window_covers_seven_days() -> None:
    window = DetectionWindow.ending_now()

    assert window.end - window.start == timedelta(days=DETECTION_WINDOW_DAYS)


def test_call_site_identity_includes_label_source() -> None:
    stats = make_stats()

    assert stats.group_key == (
        AgentLabelSource.AGENT_NAME.value,
        "Reviewer",
        "generate_content",
        "model-x",
    )
    assert (
        replace(stats, agent_label_source=AgentLabelSource.OPERATION_NAME).group_key
        != stats.group_key
    )


def test_token_derived_properties() -> None:
    ordinary = make_stats()
    exclusive_input = replace(
        ordinary,
        sum_cache_read_tokens=200_000,
        sum_cache_creation_tokens=900_000,
    )
    empty = replace(
        ordinary,
        sum_input_tokens=0,
        sum_cache_read_tokens=0,
        sum_cache_creation_tokens=0,
    )

    assert ordinary.hit_rate == 0.1
    assert ordinary.write_read_ratio == 1.5
    assert ordinary.uncached_tokens == 750_000
    assert ordinary.unrecouped_cache_write_tokens == 50_000
    assert ordinary.has_cache_activity
    assert exclusive_input.uncached_tokens == 0
    assert exclusive_input.cache_exceeds_input
    assert empty.hit_rate == 0
    assert empty.write_read_ratio is None
    assert not empty.has_cache_activity


@pytest.mark.parametrize(
    ("stats", "expected"),
    [
        pytest.param(
            make_stats(),
            Classification(CacheOutcome.HEALTHY, OutcomeReason.CACHE_ACTIVITY),
            id="healthy",
        ),
        pytest.param(
            replace(make_stats(), sum_cache_read_tokens=1_000, sum_cache_creation_tokens=0),
            Classification(CacheOutcome.NOT_CACHING, OutcomeReason.CACHE_ACTIVITY),
            id="not-caching",
        ),
        pytest.param(
            replace(make_stats(), sum_cache_read_tokens=0, sum_cache_creation_tokens=0),
            Classification(CacheOutcome.NOT_CACHING, OutcomeReason.ZERO_CACHE_TOKENS),
            id="ambiguous-zero",
        ),
        pytest.param(
            replace(
                make_stats(),
                model="gemini-2.5-pro",
                avg_input_tokens=3_000,
                sum_cache_read_tokens=0,
                sum_cache_creation_tokens=0,
            ),
            Classification(CacheOutcome.NOT_CACHING, OutcomeReason.POSITIVE_ONLY_REPORTER),
            id="positive-only-reporter",
        ),
        pytest.param(
            replace(
                make_stats(),
                sum_cache_read_tokens=80_000,
                sum_cache_creation_tokens=400_000,
            ),
            Classification(CacheOutcome.THRASH, OutcomeReason.CACHE_ACTIVITY),
            id="thrash",
        ),
        pytest.param(
            replace(make_stats(), avg_input_tokens=DEFAULT_MIN_CACHEABLE_PREFIX_TOKENS - 1),
            Classification(CacheOutcome.INELIGIBLE, OutcomeReason.SMALL_PROMPTS),
            id="small-prompts",
        ),
        pytest.param(
            replace(make_stats(), call_count=MIN_CALLS_FOR_CONFIDENCE - 1),
            Classification(CacheOutcome.INELIGIBLE, OutcomeReason.LOW_VOLUME),
            id="low-volume",
        ),
        pytest.param(
            replace(make_stats(), sampled_call_count=MIN_SAMPLED_CALLS - 1),
            Classification(CacheOutcome.INELIGIBLE, OutcomeReason.FEW_STORED_SPANS),
            id="few-stored-spans",
        ),
    ],
)
def test_classify_call_site(stats: CallSiteStats, expected: Classification) -> None:
    assert classify_call_site(stats) == expected


@pytest.mark.parametrize(
    ("model", "expected"),
    [
        ("us.anthropic.claude-haiku-4-5-20251001-v1:0", 4_096),
        ("claude-sonnet-5-5", 512),
        ("custom-model", DEFAULT_MIN_CACHEABLE_PREFIX_TOKENS),
    ],
)
def test_min_cacheable_prefix_tokens(model: str, expected: int) -> None:
    assert min_cacheable_prefix_tokens(model) == expected


def bucket(index: int, calls: float, samples: float | None = None) -> WarmthBucket:
    return WarmthBucket(
        start=index * CACHE_TTL_MINUTES * 60,
        call_count=calls,
        sample_count=calls if samples is None else samples,
    )


def test_warmth_counts_cold_starts_at_both_ttls() -> None:
    warmth = CallSiteWarmth.from_buckets(
        [bucket(index, calls) for index, calls in enumerate([1, 0, 0, 0] * 6)]
    )

    assert warmth.total_call_count == 6
    assert warmth.warm_call_count == 0
    assert warmth.long_ttl_warm_call_count == 4
    assert warmth.long_ttl_cacheable_share == pytest.approx(4 / 6)


def test_warmth_accounts_for_sampling() -> None:
    warmth = CallSiteWarmth.from_buckets([bucket(index, 10, 2) for index in range(20)])

    assert warmth.total_call_count == 200
    assert warmth.total_sample_count == 40
    assert warmth.warm_call_count == 100
    assert warmth.cacheable_share == 0.5


NOT_CACHING = Classification(CacheOutcome.NOT_CACHING, OutcomeReason.CACHE_ACTIVITY)


@pytest.mark.parametrize(
    ("warmth", "expected"),
    [
        pytest.param(CallSiteWarmth(400, 400, 250, 250), NOT_CACHING, id="enough-warm-traffic"),
        pytest.param(
            CallSiteWarmth(1_000, 1_000, 250, 250),
            Classification(CacheOutcome.INELIGIBLE, OutcomeReason.LOW_CACHEABLE_SHARE),
            id="low-cacheable-share",
        ),
        pytest.param(
            CallSiteWarmth(300, 300, 199, 199),
            Classification(CacheOutcome.INELIGIBLE, OutcomeReason.TOO_FEW_WARM_CALLS),
            id="too-few-warm-calls",
        ),
        pytest.param(
            CallSiteWarmth(400, 400, 100, 250),
            Classification(CacheOutcome.INELIGIBLE, OutcomeReason.WARM_ONLY_AT_LONG_TTL),
            id="warm-only-at-long-ttl",
        ),
        pytest.param(
            ProbeGap.FAILED,
            Classification(CacheOutcome.INELIGIBLE, OutcomeReason.PROBE_FAILED),
            id="probe-failed",
        ),
    ],
)
def test_resolve_with_warmth(warmth: CallSiteWarmth | ProbeGap, expected: Classification) -> None:
    assert resolve_with_warmth(NOT_CACHING, warmth) == expected


AMBIGUOUS_ZERO = Classification(CacheOutcome.NOT_CACHING, OutcomeReason.ZERO_CACHE_TOKENS)


@pytest.mark.parametrize(
    ("presence", "expected"),
    [
        (0, Classification(CacheOutcome.UNKNOWN, OutcomeReason.NO_CACHE_ATTRIBUTES)),
        (
            500,
            Classification(CacheOutcome.NOT_CACHING, OutcomeReason.EXPLICIT_ZERO_CACHE_TOKENS),
        ),
        (
            ProbeGap.BUDGET_EXHAUSTED,
            Classification(CacheOutcome.UNKNOWN, OutcomeReason.BUDGET_EXHAUSTED),
        ),
    ],
)
def test_resolve_with_cache_presence(presence: int | ProbeGap, expected: Classification) -> None:
    assert resolve_with_cache_presence(AMBIGUOUS_ZERO, presence) == expected


def test_severity_counts_uncached_input_and_unrecouped_writes() -> None:
    finding = CacheFinding(
        classification=Classification(CacheOutcome.THRASH, OutcomeReason.CACHE_ACTIVITY),
        stats=replace(
            make_stats(),
            sum_cache_read_tokens=80_000,
            sum_cache_creation_tokens=400_000,
        ),
    )

    assert finding.severity == 840_000
