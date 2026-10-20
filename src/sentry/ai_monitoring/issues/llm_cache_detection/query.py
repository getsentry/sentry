"""EAP row parsing for LLM prompt-cache usage detection."""

from __future__ import annotations

from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass, replace
from enum import StrEnum

from sentry.ai_monitoring.issues.llm_cache_detection.detection import (
    CACHE_TTL_MINUTES,
    MIN_CACHEABLE_PREFIX_TOKENS,
    AgentLabelSource,
    CallSiteStats,
    CallSiteWarmth,
    DetectionWindow,
    ReuseBoundary,
    WarmthBucket,
)
from sentry.exceptions import InvalidSearchQuery
from sentry.models.project import Project
from sentry.search.eap.occurrences.query_utils import build_escaped_term_filter
from sentry.search.eap.types import EAPResponse, SearchResolverConfig
from sentry.search.events.types import SAMPLING_MODES, SnubaParams, SnubaRow
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
CONVERSATION_ID = ReuseBoundary.CONVERSATION.value
CACHEABLE_CALL_FILTER = f"{GEN_AI_CALL_FILTER} {INPUT_TOKENS}:>={MIN_CACHEABLE_PREFIX_TOKENS}"

# The span name is usually the SDK wrapper; the agent name is what a reader
# can find in their code.
AGENT_NAME = AgentLabelSource.AGENT_NAME.value
EMPTY_AGENT_NAME = f'{AGENT_NAME}:""'
NAMED_AGENT_FILTER = f"has:{AGENT_NAME} !{EMPTY_AGENT_NAME}"
CONVERSATION_FILTER = f'has:{CONVERSATION_ID} !{CONVERSATION_ID}:""'
TRACE_FALLBACK_FILTER = f'(!has:{CONVERSATION_ID} OR {CONVERSATION_ID}:"")'

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
SAMPLE_CALLS_LIMIT = 3


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


def _count_unique(boundary: ReuseBoundary) -> str:
    return f"count_unique({boundary.value})"


@dataclass(frozen=True)
class SampleCall:
    """Trace metadata and token counts for one example call."""

    trace_id: str
    span_id: str
    timestamp: str
    input_tokens: float
    cache_read_tokens: float
    cache_creation_tokens: float


def _build_group_filter(stats: CallSiteStats) -> str | None:
    """Build an exact-match filter for a call site, if its values are expressible."""
    try:
        agent_term = build_escaped_term_filter(AGENT_NAME, [stats.agent_label])
        span_term = build_escaped_term_filter(SPAN_NAME, [stats.span_name])
        model_term = build_escaped_term_filter(MODEL, [stats.model])
    except InvalidSearchQuery:
        return None
    reuse_filter = (
        CONVERSATION_FILTER
        if stats.reuse_boundary is ReuseBoundary.CONVERSATION
        else TRACE_FALLBACK_FILTER
    )
    return f"{CACHEABLE_CALL_FILTER} {reuse_filter} {agent_term} {span_term} {model_term}"


def _run_spans_query(
    project: Project,
    window: DetectionWindow,
    *,
    query_string: str,
    selected_columns: list[str],
    orderby: list[str] | None,
    limit: int,
    sampling_mode: SAMPLING_MODES = "NORMAL",
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
        sampling_mode=sampling_mode,
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
        unique_reuse_count=left.unique_reuse_count + right.unique_reuse_count,
        sum_input_tokens=left.sum_input_tokens + right.sum_input_tokens,
        sum_cache_read_tokens=left.sum_cache_read_tokens + right.sum_cache_read_tokens,
        sum_cache_creation_tokens=(
            left.sum_cache_creation_tokens + right.sum_cache_creation_tokens
        ),
        avg_input_tokens=weighted_input_tokens / call_count if call_count else 0.0,
    )


def _to_call_sites(
    rows: Iterable[SnubaRow],
    reuse_boundary: ReuseBoundary = ReuseBoundary.CONVERSATION,
) -> tuple[list[CallSiteStats], Counter[DroppedRowReason]]:
    """Fold aggregate rows into call sites and count rows with incomplete keys."""
    call_sites: dict[tuple[str, str, str, str], CallSiteStats] = {}
    dropped_calls: Counter[DroppedRowReason] = Counter()
    for row in rows:
        agent_name = row.get(AGENT_NAME)
        span_name = row.get(SPAN_NAME)
        model = row.get(MODEL)
        call_count = int(row.get(COUNT) or 0)
        if not agent_name:
            dropped_calls[DroppedRowReason.NO_LABEL] += call_count
            continue
        if not span_name:
            dropped_calls[DroppedRowReason.NO_SPAN_NAME] += call_count
            continue
        if not model:
            dropped_calls[DroppedRowReason.NO_MODEL] += call_count
            continue
        stats = CallSiteStats(
            agent_label=agent_name,
            agent_label_source=AgentLabelSource.AGENT_NAME,
            reuse_boundary=reuse_boundary,
            span_name=span_name,
            model=model,
            call_count=call_count,
            sampled_call_count=int(row.get(COUNT_SAMPLE) or 0),
            unique_reuse_count=int(row.get(_count_unique(reuse_boundary)) or 0),
            sum_input_tokens=_token_count(row, SUM_INPUT_TOKENS),
            sum_cache_read_tokens=_token_count(row, SUM_CACHE_READ_TOKENS),
            sum_cache_creation_tokens=_token_count(row, SUM_CACHE_CREATION_TOKENS),
            avg_input_tokens=_token_count(row, AVG_INPUT_TOKENS),
        )
        seen = call_sites.get(stats.group_key)
        call_sites[stats.group_key] = stats if seen is None else _combine(seen, stats)
    return list(call_sites.values()), dropped_calls


def fetch_call_site_stats(project: Project, window: DetectionWindow) -> CallSiteQueryResult:
    """Aggregate cache-sized LLM calls by label, span name, and model."""
    sites_by_boundary: dict[ReuseBoundary, list[CallSiteStats]] = {}
    dropped_calls: Counter[DroppedRowReason] = Counter()
    truncated = False
    for boundary, boundary_filter in (
        (ReuseBoundary.CONVERSATION, CONVERSATION_FILTER),
        (ReuseBoundary.TRACE, TRACE_FALLBACK_FILTER),
    ):
        rows = _run_spans_query(
            project,
            window,
            query_string=f"{CACHEABLE_CALL_FILTER} {NAMED_AGENT_FILTER} {boundary_filter}",
            selected_columns=[
                AGENT_NAME,
                SPAN_NAME,
                MODEL,
                COUNT,
                COUNT_SAMPLE,
                _count_unique(boundary),
                SUM_INPUT_TOKENS,
                SUM_CACHE_READ_TOKENS,
                SUM_CACHE_CREATION_TOKENS,
                AVG_INPUT_TOKENS,
            ],
            orderby=[f"-{SUM_INPUT_TOKENS}"],
            limit=CALL_SITE_GROUPS_LIMIT,
            sampling_mode="HIGHEST_ACCURACY",
        ).get("data", [])
        sites_by_boundary[boundary], dropped = _to_call_sites(rows, boundary)
        dropped_calls.update(dropped)
        truncated |= len(rows) >= CALL_SITE_GROUPS_LIMIT

    conversation_sites = sites_by_boundary[ReuseBoundary.CONVERSATION]
    covered = {stats.group_key for stats in conversation_sites}
    call_sites = [
        *conversation_sites,
        *(
            stats
            for stats in sites_by_boundary[ReuseBoundary.TRACE]
            if stats.group_key not in covered
        ),
    ]
    call_sites.sort(key=lambda stats: stats.sum_input_tokens, reverse=True)
    return CallSiteQueryResult(
        call_sites=call_sites[:CALL_SITE_GROUPS_LIMIT],
        dropped_calls=dropped_calls,
        truncated=truncated or len(call_sites) > CALL_SITE_GROUPS_LIMIT,
    )


def fetch_call_site_warmth(
    project: Project, stats: CallSiteStats, window: DetectionWindow
) -> CallSiteWarmth | None:
    """Count calls per cache-TTL bucket, or return None for an invalid filter."""
    group_filter = _build_group_filter(stats)
    if group_filter is None:
        return None
    unique_count = _count_unique(stats.reuse_boundary)
    result = Spans.run_timeseries_query(
        params=SnubaParams(
            start=window.start,
            end=window.end,
            projects=[project],
            organization=project.organization,
            granularity_secs=CACHE_TTL_MINUTES * 60,
        ),
        query_string=group_filter,
        y_axes=[COUNT, unique_count],
        referrer=Referrer.ISSUES_LLM_CACHE_DETECTION.value,
        config=SearchResolverConfig(auto_fields=True),
        sampling_mode="NORMAL",
    )
    return CallSiteWarmth.from_buckets(_warmth_buckets(result, unique_count))


def _warmth_buckets(result: SnubaTSResult, unique_count: str) -> list[WarmthBucket]:
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
            unique_reuse_count=float(point.get(unique_count) or 0),
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


def fetch_sample_calls(
    project: Project, stats: CallSiteStats, window: DetectionWindow
) -> list[SampleCall] | None:
    """Return the largest call from up to three traces, without prompt content."""
    group_filter = _build_group_filter(stats)
    if group_filter is None:
        return None
    result = _run_spans_query(
        project,
        window,
        query_string=group_filter,
        selected_columns=[
            "trace",
            "id",
            "timestamp",
            INPUT_TOKENS,
            *CACHE_TOKEN_ATTRIBUTES,
        ],
        orderby=[f"-{INPUT_TOKENS}"],
        limit=SAMPLE_CALLS_LIMIT * 3,
    )

    samples: list[SampleCall] = []
    seen_trace_ids: set[str] = set()
    for row in result.get("data", []):
        trace_id = row.get("trace")
        span_id = row.get("id")
        timestamp = row.get("timestamp")
        if not trace_id or not span_id or not timestamp or trace_id in seen_trace_ids:
            continue
        seen_trace_ids.add(trace_id)
        samples.append(
            SampleCall(
                trace_id=trace_id,
                span_id=span_id,
                timestamp=timestamp,
                input_tokens=_token_count(row, INPUT_TOKENS),
                cache_read_tokens=_token_count(row, CACHE_READ_TOKENS),
                cache_creation_tokens=_token_count(row, CACHE_CREATION_TOKENS),
            )
        )
        if len(samples) == SAMPLE_CALLS_LIMIT:
            break
    return samples
