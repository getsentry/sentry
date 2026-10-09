from __future__ import annotations

from dataclasses import replace
from datetime import timedelta

from sentry.ai_monitoring.issues.llm_cache_detection.detection import (
    DETECTION_WINDOW_DAYS,
    AgentLabelSource,
    CallSiteStats,
    DetectionWindow,
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
        avg_input_tokens=1_000,
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
