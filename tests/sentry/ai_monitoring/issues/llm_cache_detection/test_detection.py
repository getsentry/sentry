from __future__ import annotations

from dataclasses import replace
from datetime import timedelta

import pytest

from sentry.ai_monitoring.issues.llm_cache_detection.detection import (
    DEFAULT_MIN_CACHEABLE_PREFIX_TOKENS,
    DETECTION_WINDOW_DAYS,
    MIN_CALLS_FOR_CONFIDENCE,
    MIN_SAMPLED_CALLS,
    AgentLabelSource,
    CacheFinding,
    CacheOutcome,
    CallSiteStats,
    Classification,
    DetectionWindow,
    OutcomeReason,
    classify_call_site,
    min_cacheable_prefix_tokens,
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
