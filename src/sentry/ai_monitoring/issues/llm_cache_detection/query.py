"""EAP row parsing for LLM prompt-cache usage detection."""

from __future__ import annotations

from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass, replace
from enum import StrEnum

from sentry.ai_monitoring.issues.llm_cache_detection.detection import (
    CACHE_TTL_MINUTES,
    AgentLabelSource,
    CallSiteStats,
    CallSiteWarmth,
    DetectionWindow,
    WarmthBucket,
)
from sentry.exceptions import InvalidSearchQuery
from sentry.models.project import Project
from sentry.search.eap.occurrences.query_utils import build_escaped_term_filter
from sentry.search.eap.types import EAPResponse, SearchResolverConfig
from sentry.search.events.types import SnubaParams, SnubaRow
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans
from sentry.utils.snuba import SnubaTSResult

# ai_client is derived from span op at ingestion. It covers LLM calls from all
# SDKs while excluding agent spans with reaggregated token totals.
GEN_AI_CALL_FILTER = (
    "gen_ai.operation.type:ai_client "
    "!gen_ai.operation.name:embeddings "
    "has:gen_ai.usage.input_tokens"
)

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
CACHE_TOKEN_ATTRIBUTES = (CACHE_READ_TOKENS, CACHE_CREATION_TOKENS)

SUM_INPUT_TOKENS = f"sum({INPUT_TOKENS})"
AVG_INPUT_TOKENS = f"avg({INPUT_TOKENS})"
SUM_CACHE_READ_TOKENS = f"sum({CACHE_READ_TOKENS})"
SUM_CACHE_CREATION_TOKENS = f"sum({CACHE_CREATION_TOKENS})"
COUNT = "count()"

# Unlike count(), this records stored spans instead of extrapolated calls.
COUNT_SAMPLE = "count_sample()"

# Order by input tokens so the highest-volume groups fit when the query reaches
# its limit. Agent operation groups may be folded after this limit is applied.
CALL_SITE_GROUPS_LIMIT = 300


class DroppedRowReason(StrEnum):
    """What an aggregate row lacked that a call site is keyed on."""

    NO_LABEL = "no_label"
    NO_SPAN_NAME = "no_span_name"
    NO_MODEL = "no_model"


@dataclass(frozen=True)
class CallSiteQueryResult:
    call_sites: list[CallSiteStats]
    dropped_calls: Counter[DroppedRowReason]
    truncated: bool


def _build_group_filter(stats: CallSiteStats) -> str | None:
    """Build an exact-match filter for a call site, if its values are expressible."""
    agent_attribute = (
        AGENT_NAME if stats.agent_label_source is AgentLabelSource.AGENT_NAME else OPERATION_NAME
    )
    try:
        agent_term = build_escaped_term_filter(agent_attribute, [stats.agent_label])
        span_term = build_escaped_term_filter(SPAN_NAME, [stats.span_name])
        model_term = build_escaped_term_filter(MODEL, [stats.model])
    except InvalidSearchQuery:
        return None
    if stats.agent_label_source is AgentLabelSource.OPERATION_NAME:
        agent_term = f"!has:{AGENT_NAME} {agent_term}"
    return f"{GEN_AI_CALL_FILTER} {agent_term} {span_term} {model_term}"


def _run_spans_query(
    project: Project,
    window: DetectionWindow,
    *,
    query_string: str,
    selected_columns: list[str],
    orderby: list[str] | None,
    limit: int,
) -> EAPResponse:
    return Spans.run_table_query(
        params=SnubaParams(
            start=window.start,
            end=window.end,
            projects=[project],
            organization=project.organization,
        ),
        query_string=query_string,
        selected_columns=selected_columns,
        orderby=orderby,
        offset=0,
        limit=limit,
        referrer=Referrer.ISSUES_LLM_CACHE_DETECTION.value,
        config=SearchResolverConfig(auto_fields=True),
        sampling_mode="NORMAL",
    )


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


def fetch_call_site_stats(project: Project, window: DetectionWindow) -> CallSiteQueryResult:
    """Aggregate LLM calls by agent label, span name, and model."""
    result = _run_spans_query(
        project,
        window,
        query_string=GEN_AI_CALL_FILTER,
        selected_columns=[
            AGENT_NAME,
            OPERATION_NAME,
            SPAN_NAME,
            MODEL,
            COUNT,
            COUNT_SAMPLE,
            SUM_INPUT_TOKENS,
            SUM_CACHE_READ_TOKENS,
            SUM_CACHE_CREATION_TOKENS,
            AVG_INPUT_TOKENS,
        ],
        orderby=[f"-{SUM_INPUT_TOKENS}"],
        limit=CALL_SITE_GROUPS_LIMIT,
    )
    rows = result.get("data", [])
    call_sites, dropped_calls = _to_call_sites(rows)
    return CallSiteQueryResult(
        call_sites=call_sites,
        dropped_calls=dropped_calls,
        truncated=len(rows) >= CALL_SITE_GROUPS_LIMIT,
    )


def fetch_call_site_warmth(
    project: Project, stats: CallSiteStats, window: DetectionWindow
) -> CallSiteWarmth | None:
    """Count calls per cache-TTL bucket, or return None for an invalid filter."""
    group_filter = _build_group_filter(stats)
    if group_filter is None:
        return None
    result = Spans.run_timeseries_query(
        params=SnubaParams(
            start=window.start,
            end=window.end,
            projects=[project],
            organization=project.organization,
            granularity_secs=CACHE_TTL_MINUTES * 60,
        ),
        query_string=group_filter,
        y_axes=[COUNT],
        referrer=Referrer.ISSUES_LLM_CACHE_DETECTION.value,
        config=SearchResolverConfig(auto_fields=True),
        sampling_mode="NORMAL",
    )
    return CallSiteWarmth.from_buckets(_warmth_buckets(result))


def _warmth_buckets(result: SnubaTSResult) -> list[WarmthBucket]:
    """Pair extrapolated calls with stored-span counts in each time bucket."""
    processed = result.data.get("processed_timeseries")
    if processed is None:
        return []
    sample_counts = processed.sample_count
    return [
        WarmthBucket(
            start=int(point["time"]),
            call_count=float(point.get(COUNT) or 0),
            sample_count=(
                float(sample_counts[index].get(COUNT) or 0) if index < len(sample_counts) else 0.0
            ),
        )
        for index, point in enumerate(processed.timeseries)
    ]


def count_spans_with_cache_attributes(
    project: Project, stats: CallSiteStats, window: DetectionWindow
) -> int | None:
    """Count call-site spans carrying a cache attribute, if the filter is valid."""
    group_filter = _build_group_filter(stats)
    if group_filter is None:
        return None
    cache_attribute_filter = " OR ".join(f"has:{attribute}" for attribute in CACHE_TOKEN_ATTRIBUTES)
    result = _run_spans_query(
        project,
        window,
        query_string=f"{group_filter} ({cache_attribute_filter})",
        selected_columns=[COUNT],
        orderby=None,
        limit=1,
    )
    data = result.get("data", [])
    return int(data[0].get(COUNT) or 0) if data else 0
