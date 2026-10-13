"""EAP row parsing for LLM prompt-cache usage detection."""

from __future__ import annotations

from collections import Counter
from collections.abc import Iterable
from dataclasses import replace
from enum import StrEnum

from sentry.ai_monitoring.issues.llm_cache_detection.detection import (
    AgentLabelSource,
    CallSiteStats,
)
from sentry.search.events.types import SnubaRow

INPUT_TOKENS = "gen_ai.usage.input_tokens"
MODEL = "gen_ai.request.model"
SPAN_NAME = "span.name"

# The span name is usually the SDK wrapper; the agent name is what a reader
# can find in their code. The operation name stands in where it is missing.
AGENT_NAME = AgentLabelSource.AGENT_NAME.value
OPERATION_NAME = AgentLabelSource.OPERATION_NAME.value

# Deprecated SDK aliases are backfilled onto these attributes at ingestion.
CACHE_READ_TOKENS = "gen_ai.usage.cache_read.input_tokens"
CACHE_CREATION_TOKENS = "gen_ai.usage.cache_creation.input_tokens"

SUM_INPUT_TOKENS = f"sum({INPUT_TOKENS})"
AVG_INPUT_TOKENS = f"avg({INPUT_TOKENS})"
SUM_CACHE_READ_TOKENS = f"sum({CACHE_READ_TOKENS})"
SUM_CACHE_CREATION_TOKENS = f"sum({CACHE_CREATION_TOKENS})"
COUNT = "count()"

# Unlike count(), this records stored spans instead of extrapolated calls.
COUNT_SAMPLE = "count_sample()"


class DroppedRowReason(StrEnum):
    """What an aggregate row lacked that a call site is keyed on."""

    NO_LABEL = "no_label"
    NO_SPAN_NAME = "no_span_name"
    NO_MODEL = "no_model"


def _token_count(row: SnubaRow, column: str) -> float:
    """Read a token column, treating a missing or null value as zero."""
    return float(row.get(column) or 0)


def _combine(left: CallSiteStats, right: CallSiteStats) -> CallSiteStats:
    """Add two aggregate rows of one call site and reweight their average."""
    call_count = left.call_count + right.call_count
    weighted_input_tokens = (
        left.avg_input_tokens * left.call_count + right.avg_input_tokens * right.call_count
    )
    return replace(
        left,
        call_count=call_count,
        sampled_call_count=left.sampled_call_count + right.sampled_call_count,
        sum_input_tokens=left.sum_input_tokens + right.sum_input_tokens,
        sum_cache_read_tokens=left.sum_cache_read_tokens + right.sum_cache_read_tokens,
        sum_cache_creation_tokens=(
            left.sum_cache_creation_tokens + right.sum_cache_creation_tokens
        ),
        avg_input_tokens=weighted_input_tokens / call_count if call_count else 0.0,
    )


def _to_call_sites(
    rows: Iterable[SnubaRow],
) -> tuple[list[CallSiteStats], Counter[DroppedRowReason]]:
    """Fold aggregate rows into call sites and count rows with incomplete keys."""
    call_sites: dict[tuple[str, str, str, str], CallSiteStats] = {}
    dropped_calls: Counter[DroppedRowReason] = Counter()
    for row in rows:
        agent_name = row.get(AGENT_NAME)
        operation_name = row.get(OPERATION_NAME)
        span_name = row.get(SPAN_NAME)
        model = row.get(MODEL)
        call_count = int(row.get(COUNT) or 0)
        if agent_name:
            agent_label = agent_name
            agent_label_source = AgentLabelSource.AGENT_NAME
        elif operation_name:
            agent_label = operation_name
            agent_label_source = AgentLabelSource.OPERATION_NAME
        else:
            dropped_calls[DroppedRowReason.NO_LABEL] += call_count
            continue
        if not span_name:
            dropped_calls[DroppedRowReason.NO_SPAN_NAME] += call_count
            continue
        if not model:
            dropped_calls[DroppedRowReason.NO_MODEL] += call_count
            continue
        stats = CallSiteStats(
            agent_label=agent_label,
            agent_label_source=agent_label_source,
            span_name=span_name,
            model=model,
            call_count=call_count,
            sampled_call_count=int(row.get(COUNT_SAMPLE) or 0),
            sum_input_tokens=_token_count(row, SUM_INPUT_TOKENS),
            sum_cache_read_tokens=_token_count(row, SUM_CACHE_READ_TOKENS),
            sum_cache_creation_tokens=_token_count(row, SUM_CACHE_CREATION_TOKENS),
            avg_input_tokens=_token_count(row, AVG_INPUT_TOKENS),
        )
        seen = call_sites.get(stats.group_key)
        call_sites[stats.group_key] = stats if seen is None else _combine(seen, stats)
    return list(call_sites.values()), dropped_calls
