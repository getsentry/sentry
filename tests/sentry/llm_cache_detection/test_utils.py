from __future__ import annotations

from sentry.llm_cache_detection.detection import AgentLabelSource, CallSiteStats


def make_stats(
    *,
    agent_label: str = "Some Agent",
    agent_label_source: AgentLabelSource = AgentLabelSource.AGENT_NAME,
    span_name: str = "generate_content generate_structured",
    model: str = "model-x",
    call_count: int = 10_000,
    avg_input_tokens: float = 2_000,
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
