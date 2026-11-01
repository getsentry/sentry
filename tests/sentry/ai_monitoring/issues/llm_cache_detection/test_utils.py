from __future__ import annotations

from sentry.ai_monitoring.issues.llm_cache_detection.detection import (
    AgentLabelSource,
    CallSiteStats,
    ReuseBoundary,
)


def make_stats(
    *,
    agent_label: str = "Some Agent",
    span_name: str = "generate_content generate_structured",
    model: str = "model-x",
    call_count: int = 10_000,
    avg_input_tokens: float = 5_000,
    hit_rate: float = 0.0,
    write_read_ratio: float = 0.0,
    sampled_call_count: int | None = None,
    unique_reuse_count: int | None = None,
    reuse_boundary: ReuseBoundary = ReuseBoundary.CONVERSATION,
) -> CallSiteStats:
    """Build stats from cache ratios instead of raw token sums."""
    sum_input = call_count * avg_input_tokens
    sum_read = hit_rate * sum_input
    sum_creation = write_read_ratio * sum_read
    sampled_calls = call_count if sampled_call_count is None else sampled_call_count
    return CallSiteStats(
        agent_label=agent_label,
        agent_label_source=AgentLabelSource.AGENT_NAME,
        reuse_boundary=reuse_boundary,
        span_name=span_name,
        model=model,
        call_count=call_count,
        sampled_call_count=sampled_calls,
        unique_reuse_count=(
            sampled_calls // 2 if unique_reuse_count is None else unique_reuse_count
        ),
        sum_input_tokens=sum_input,
        sum_cache_read_tokens=sum_read,
        sum_cache_creation_tokens=sum_creation,
        avg_input_tokens=avg_input_tokens,
    )
