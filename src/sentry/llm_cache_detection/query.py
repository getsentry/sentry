"""EAP span queries for LLM prompt-cache usage detection."""

from __future__ import annotations

from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass, replace
from enum import StrEnum

from sentry_conventions.attributes import ATTRIBUTE_NAMES

from sentry.llm_cache_detection.detection import (
    CACHE_TTL_MINUTES,
    AgentLabelSource,
    CallSiteStats,
    CallSiteWarmth,
    DetectionWindow,
    WarmthBucket,
)
from sentry.models.project import Project
from sentry.search.eap.types import EAPResponse, SearchResolverConfig
from sentry.search.events.types import SnubaParams, SnubaRow
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans
from sentry.utils.snuba import SnubaTSResult

# `ai_client` is derived from the op at ingestion, so it matches LLM calls from
# every SDK, and excludes agent spans with their re-aggregated token totals.
# Embeddings have no prompt cache.
GEN_AI_CALL_FILTER = (
    "gen_ai.operation.type:ai_client "
    "!gen_ai.operation.name:embeddings "
    "has:gen_ai.usage.input_tokens"
)

INPUT_TOKENS = "gen_ai.usage.input_tokens"
MODEL = "gen_ai.request.model"
SPAN_NAME = "span.name"
# The span name is usually just the SDK wrapper; the agent name is what a reader
# can find in their code. The operation name stands in where it is missing.
AGENT_NAME = AgentLabelSource.AGENT_NAME.value
OPERATION_NAME = AgentLabelSource.OPERATION_NAME.value

# The deprecated aliases most SDKs emit are backfilled onto these at ingestion,
# so these cover both; reading the aliases as well would double-count.
CACHE_READ_TOKENS = "gen_ai.usage.cache_read.input_tokens"
CACHE_CREATION_TOKENS = "gen_ai.usage.cache_creation.input_tokens"
CACHE_TOKEN_ATTRIBUTES = (CACHE_READ_TOKENS, CACHE_CREATION_TOKENS)

# SDKs are part-way through moving to `gen_ai.input.messages`, so the deprecated
# name is read too; spelled out because `ATTRIBUTE_NAMES` warns on access.
PROMPT_ATTRIBUTES = (
    ATTRIBUTE_NAMES.GEN_AI_INPUT_MESSAGES,
    "gen_ai.request.messages",
)

SUM_INPUT_TOKENS = f"sum({INPUT_TOKENS})"
AVG_INPUT_TOKENS = f"avg({INPUT_TOKENS})"
SUM_CACHE_READ_TOKENS = f"sum({CACHE_READ_TOKENS})"
SUM_CACHE_CREATION_TOKENS = f"sum({CACHE_CREATION_TOKENS})"
COUNT = "count()"
# Unlike `count()`, not extrapolated: the evidence the aggregates rest on.
COUNT_SAMPLE = "count_sample()"

# Ordered by input tokens, so the worst offenders fit. Applied before an agent's
# operation names are folded together, so a call site can come back partial.
CALL_SITE_GROUPS_LIMIT = 300

WARMTH_GRANULARITY_SECS = CACHE_TTL_MINUTES * 60
SAMPLE_CALLS_LIMIT = 3
# Over-fetched because rows are deduplicated by trace.
SAMPLE_CALLS_QUERY_LIMIT = SAMPLE_CALLS_LIMIT * 3

PROMPT_SAMPLES_LIMIT = 4
PROMPT_SAMPLES_QUERY_LIMIT = PROMPT_SAMPLES_LIMIT * 3
# Bounds how much customer content is read, generously next to the lengths the
# diagnosis reasons about.
PROMPT_MAX_CHARS = 32_768


class DroppedRowReason(StrEnum):
    """What an aggregate row lacked that a call site is keyed on."""

    NO_LABEL = "no_label"
    NO_SPAN_NAME = "no_span_name"
    NO_MODEL = "no_model"


@dataclass(frozen=True)
class CallSiteQueryResult:
    call_sites: list[CallSiteStats]
    # Extrapolated calls no call site can be keyed on, by what they lacked.
    dropped_calls: Counter[DroppedRowReason]
    # `CALL_SITE_GROUPS_LIMIT` was reached.
    truncated: bool


@dataclass(frozen=True)
class SampleCall:
    """One example call from a flagged call site, with what a trace link needs."""

    trace_id: str
    span_id: str
    timestamp: str
    input_tokens: float
    cache_read_tokens: float
    cache_creation_tokens: float


def _escape_filter_value(value: str) -> str:
    """Escape a value for a quoted EAP search term.

    An unescaped ``*`` degrades the match to a wildcard. Backslashes are kept
    verbatim by the grammar, so escaping one would change the value.
    """
    return value.replace('"', '\\"').replace("*", "\\*")


def _is_unexpressible(value: str) -> bool:
    """Whether the search grammar cannot match this value exactly: a trailing
    backslash escapes the closing quote, and ``\\*`` always reads as an escape."""
    return value.endswith("\\") or "\\*" in value


def _build_group_filter(stats: CallSiteStats) -> str | None:
    """Build the exact-match filter for one call site, or None if unexpressible."""
    values = (stats.agent_label, stats.span_name, stats.model)
    if any(_is_unexpressible(value) for value in values):
        return None
    agent_label, span_name, model = (_escape_filter_value(value) for value in values)
    if stats.agent_label_source is AgentLabelSource.AGENT_NAME:
        agent_terms = [f'{AGENT_NAME}:"{agent_label}"']
    else:
        # Otherwise named spans sharing the operation, a different call site,
        # would match too.
        agent_terms = [f"!has:{AGENT_NAME}", f'{OPERATION_NAME}:"{agent_label}"']
    return " ".join(
        [
            GEN_AI_CALL_FILTER,
            *agent_terms,
            f'{SPAN_NAME}:"{span_name}"',
            f'{MODEL}:"{model}"',
        ]
    )


def _run_spans_query(
    project: Project,
    window: DetectionWindow,
    *,
    query_string: str,
    selected_columns: list[str],
    orderby: list[str] | None,
    limit: int,
    referrer: Referrer,
    max_string_length: int | None = None,
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
        referrer=referrer.value,
        config=SearchResolverConfig(auto_fields=True),
        sampling_mode="NORMAL",
        max_string_length=max_string_length,
    )


def _token_count(row: SnubaRow, column: str) -> float:
    """Read a token column, treating a missing or null value as zero."""
    return float(row.get(column) or 0)


def _agent_label(row: SnubaRow) -> tuple[str, AgentLabelSource] | None:
    """Read one row's agent label, falling back to its operation name.

    Decided per row, not per group: one (span.name, model) pair can hold named and
    unnamed spans, and merging them would credit an agent with calls it never made.
    """
    agent_name = row.get(AGENT_NAME)
    if agent_name:
        return agent_name, AgentLabelSource.AGENT_NAME
    operation_name = row.get(OPERATION_NAME)
    if operation_name:
        return operation_name, AgentLabelSource.OPERATION_NAME
    return None


def _combine(left: CallSiteStats, right: CallSiteStats) -> CallSiteStats:
    """Add two aggregate rows of one call site, re-weighting the average by calls."""
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
    """Fold aggregate rows into call sites keyed by (agent label, span.name, model).

    The query groups by operation name too, to resolve the fallback, which splits
    a named agent reporting several operations; that split is undone here. Rows
    missing part of the key are counted by calls, under the first part missing.
    """
    call_sites: dict[tuple[str, str, str, str], CallSiteStats] = {}
    dropped_calls: Counter[DroppedRowReason] = Counter()
    for row in rows:
        label = _agent_label(row)
        span_name = row.get(SPAN_NAME)
        model = row.get(MODEL)
        call_count = int(row.get(COUNT) or 0)
        if label is None:
            dropped_calls[DroppedRowReason.NO_LABEL] += call_count
            continue
        if not span_name:
            dropped_calls[DroppedRowReason.NO_SPAN_NAME] += call_count
            continue
        if not model:
            dropped_calls[DroppedRowReason.NO_MODEL] += call_count
            continue
        agent_label, agent_label_source = label
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
    """Aggregate gen-AI call spans per (agent label, span.name, model)."""
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
        referrer=Referrer.ISSUES_LLM_CACHE_DETECTION_CALL_SITES,
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
    """Count one call site's calls per cache-TTL bucket, or None if unqueryable."""
    group_filter = _build_group_filter(stats)
    if group_filter is None:
        return None
    result = Spans.run_timeseries_query(
        params=SnubaParams(
            start=window.start,
            end=window.end,
            projects=[project],
            organization=project.organization,
            granularity_secs=WARMTH_GRANULARITY_SECS,
        ),
        query_string=group_filter,
        y_axes=[COUNT],
        referrer=Referrer.ISSUES_LLM_CACHE_DETECTION_WARMTH.value,
        config=SearchResolverConfig(auto_fields=True),
        sampling_mode="NORMAL",
    )
    return CallSiteWarmth.from_buckets(_warmth_buckets(result))


def _warmth_buckets(result: SnubaTSResult) -> list[WarmthBucket]:
    """Pair each bucket's extrapolated count with its stored-span count, which
    ``processed_timeseries`` carries as separate lists indexed alike."""
    processed = result.data.get("processed_timeseries")
    if processed is None:
        return []
    sample_counts = processed.sample_count
    return [
        WarmthBucket(
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
    """How many of the call site's spans carry any cache attribute, or None if
    unqueryable."""
    group_filter = _build_group_filter(stats)
    if group_filter is None:
        return None
    cache_attribute_present = " OR ".join(
        f"has:{attribute}" for attribute in CACHE_TOKEN_ATTRIBUTES
    )
    result = _run_spans_query(
        project,
        window,
        query_string=f"{group_filter} ({cache_attribute_present})",
        selected_columns=[COUNT],
        orderby=None,
        limit=1,
        referrer=Referrer.ISSUES_LLM_CACHE_DETECTION_CACHE_PRESENCE,
    )
    data = result.get("data", [])
    if not data:
        return 0
    return int(data[0].get(COUNT) or 0)


def fetch_sample_calls(
    project: Project, stats: CallSiteStats, window: DetectionWindow
) -> list[SampleCall]:
    """Sample the call site's largest calls, one per trace."""
    group_filter = _build_group_filter(stats)
    if group_filter is None:
        return []
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
        limit=SAMPLE_CALLS_QUERY_LIMIT,
        referrer=Referrer.ISSUES_LLM_CACHE_DETECTION_TRACE_SAMPLES,
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


def fetch_sample_prompts(
    project: Project, stats: CallSiteStats, window: DetectionWindow
) -> list[str] | None:
    """Read the prompts of the call site's most recent invocations, one per trace.

    Recent rather than largest, since the template the code assembles now is what
    matters. None if unqueryable; empty if the spans carry no prompt text.
    """
    group_filter = _build_group_filter(stats)
    if group_filter is None:
        return None
    prompt_present = " OR ".join(f"has:{attribute}" for attribute in PROMPT_ATTRIBUTES)
    result = _run_spans_query(
        project,
        window,
        query_string=f"{group_filter} ({prompt_present})",
        selected_columns=["trace", "timestamp", *PROMPT_ATTRIBUTES],
        orderby=["-timestamp"],
        limit=PROMPT_SAMPLES_QUERY_LIMIT,
        referrer=Referrer.ISSUES_LLM_CACHE_DETECTION_PROMPT_SAMPLES,
        max_string_length=PROMPT_MAX_CHARS,
    )

    prompts: list[str] = []
    seen_trace_ids: set[str] = set()
    for row in result.get("data", []):
        trace_id = row.get("trace")
        if trace_id in seen_trace_ids:
            continue
        prompt = next(
            (str(row[attribute]) for attribute in PROMPT_ATTRIBUTES if row.get(attribute)), None
        )
        if prompt is None:
            continue
        if trace_id:
            seen_trace_ids.add(trace_id)
        prompts.append(prompt)
        if len(prompts) == PROMPT_SAMPLES_LIMIT:
            break
    return prompts
