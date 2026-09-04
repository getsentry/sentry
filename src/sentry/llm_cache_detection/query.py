"""EAP span queries for LLM prompt-cache usage detection."""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass, replace

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

# `ai_client` is added during ingestion from the op, so it matches an LLM call
# whichever op the SDK chose; matching an op directly would cover one integration.
# Agent spans carry their own type, which keeps out invoke_agent's re-aggregated
# token totals. Embeddings classify as LLM calls but have no prompt cache, so
# they are excluded by hand -- a model that reports cache tokens only when
# positive would otherwise read as a genuine 0% hit rate.
GEN_AI_CALL_FILTER = (
    "gen_ai.operation.type:ai_client "
    "!gen_ai.operation.name:embeddings "
    "has:gen_ai.usage.input_tokens"
)

INPUT_TOKENS = "gen_ai.usage.input_tokens"
MODEL = "gen_ai.request.model"
SPAN_NAME = "span.name"
# `gen_ai.agent.name` names the agent a call belongs to, which is what a reader
# can find in their own code; the span name alone is usually the SDK wrapper.
# It is not universally emitted, so the operation name stands in where it is
# missing -- see `_agent_label` for why that choice is made per span.
AGENT_NAME = AgentLabelSource.AGENT_NAME.value
OPERATION_NAME = AgentLabelSource.OPERATION_NAME.value

# Most integrations emit the deprecated aliases (`gen_ai.usage.input_tokens.cached`
# and `.cache_write`); only langchain writes these names directly. Each alias is
# declared in `sentry_conventions` as a BACKFILL deprecation of the name below
# it, and the backfill is applied to the stored item, so querying the canonical
# names covers both -- and reading either family alongside them would
# double-count.
CACHE_READ_TOKENS = "gen_ai.usage.cache_read.input_tokens"
CACHE_CREATION_TOKENS = "gen_ai.usage.cache_creation.input_tokens"
CACHE_TOKEN_ATTRIBUTES = (CACHE_READ_TOKENS, CACHE_CREATION_TOKENS)

# `gen_ai.request.messages` is deprecated in favour of `gen_ai.input.messages`
# and SDKs are part-way through the move, so both are read, current name first.
# Carrying prompt text at all is opt-in and off by default, so most call sites
# have neither.
PROMPT_ATTRIBUTES = (
    ATTRIBUTE_NAMES.GEN_AI_INPUT_MESSAGES,
    ATTRIBUTE_NAMES.GEN_AI_REQUEST_MESSAGES,
)

# An aggregate column doubles as the key its value comes back under, so the
# query and the code reading the response share one name.
SUM_INPUT_TOKENS = f"sum({INPUT_TOKENS})"
AVG_INPUT_TOKENS = f"avg({INPUT_TOKENS})"
SUM_CACHE_READ_TOKENS = f"sum({CACHE_READ_TOKENS})"
SUM_CACHE_CREATION_TOKENS = f"sum({CACHE_CREATION_TOKENS})"
COUNT = "count()"
# `count()` is extrapolated to the traffic the spans stand for; this one is not,
# so the pair says how much evidence each aggregate beside it was computed from.
COUNT_SAMPLE = "count_sample()"

# Sorting by total input tokens keeps the worst offenders inside the cap even
# when a project has more distinct call sites than this.
CALL_SITE_GROUPS_LIMIT = 300

# Warmth is read off calls counted per cache TTL, so the timeseries is bucketed
# at the TTL itself: within a bucket, every call but the first had a predecessor
# close enough to find the cache warm.
WARMTH_GRANULARITY_SECS = CACHE_TTL_MINUTES * 60
SAMPLE_CALLS_LIMIT = 3
# Sampled rows are deduplicated by trace, so ask for enough of them that a call
# site repeating within one trace still yields distinct examples.
SAMPLE_CALLS_QUERY_LIMIT = SAMPLE_CALLS_LIMIT * 3

# Each sampled prompt is a whole message list, so this is the widest row the
# detector reads. Four is enough that a field varying only occasionally still
# shows up, without paying for a long list of very large attribute values.
PROMPT_SAMPLES_LIMIT = 4
PROMPT_SAMPLES_QUERY_LIMIT = PROMPT_SAMPLES_LIMIT * 3
# Prompts are the one thing the detector reads that is customer content rather
# than a measurement, so how much of it is pulled out of storage is bounded here
# rather than left to whatever ingest happened to keep. Generous next to the
# lengths the diagnosis reasons about, which is what keeps the truncation from
# deciding the answer.
PROMPT_MAX_CHARS = 32_768


@dataclass(frozen=True)
class SampleCall:
    """One example call from a flagged call site.

    Carries what a deep link into the trace needs -- the span itself, and the
    timestamp the trace view resolves the trace by -- alongside the token counts
    that make the example worth opening.
    """

    trace_id: str
    span_id: str
    timestamp: str
    input_tokens: float
    cache_read_tokens: float
    cache_creation_tokens: float


def _escape_filter_value(value: str) -> str:
    """Escape a value for a quoted EAP search term.

    ``*`` must be escaped or OP_EQUALS silently degrades to a LIKE wildcard
    match; ``"`` would terminate the quoted term. Backslashes are left alone
    because the grammar preserves them verbatim -- escaping one would change
    the value being matched.
    """
    return value.replace('"', '\\"').replace("*", "\\*")


def _is_unexpressible(value: str) -> bool:
    """Whether the search grammar cannot match this value exactly.

    A trailing backslash escapes the term's own closing quote. A backslash
    directly before a ``*`` reads as an escaped wildcard whichever way the star
    is written, so the literal cannot be expressed at all.
    """
    return value.endswith("\\") or "\\*" in value


def _build_group_filter(stats: CallSiteStats) -> str | None:
    """Build the exact-match filter for one call-site group.

    Returns None when a group value cannot be expressed in the search grammar.
    """
    values = (stats.agent_label, stats.span_name, stats.model)
    if any(_is_unexpressible(value) for value in values):
        return None
    agent_label, span_name, model = (_escape_filter_value(value) for value in values)
    if stats.agent_label_source is AgentLabelSource.AGENT_NAME:
        agent_terms = [f'{AGENT_NAME}:"{agent_label}"']
    else:
        # The operation name only stands in for an agent on spans that carry no
        # agent name, so the absence defines the group as much as the operation
        # does: without this term the filter would also collect the named spans
        # sharing the operation, which are a different call site.
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

    The fallback is decided per row rather than once for the group because a
    single (span.name, model) pair can hold spans that carry an agent name and
    spans that do not, side by side. Those are kept apart: an unnamed span
    merged into a named sibling would attribute calls to an agent that never
    made them.

    Returns None when a row carries neither, which leaves nothing to name the
    call site by.
    """
    agent_name = row.get(AGENT_NAME)
    if agent_name:
        return agent_name, AgentLabelSource.AGENT_NAME
    operation_name = row.get(OPERATION_NAME)
    if operation_name:
        return operation_name, AgentLabelSource.OPERATION_NAME
    return None


def _combine(left: CallSiteStats, right: CallSiteStats) -> CallSiteStats:
    """Add two aggregate rows describing the same call site.

    The average is re-weighted by call count rather than averaged again, so the
    result is the average over every call in the group.
    """
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


def _to_call_sites(rows: Iterable[SnubaRow]) -> list[CallSiteStats]:
    """Fold aggregate rows into call sites keyed by (agent label, span.name, model).

    The query has to group by the agent name and the operation name separately
    to resolve the fallback, which splits one call site in two whenever spans
    under one agent report different operation names -- a split the key does not
    make, so it is undone here.
    """
    call_sites: dict[tuple[str, str, str, str], CallSiteStats] = {}
    for row in rows:
        label = _agent_label(row)
        span_name = row.get(SPAN_NAME)
        model = row.get(MODEL)
        if label is None or not span_name or not model:
            continue
        agent_label, agent_label_source = label
        stats = CallSiteStats(
            agent_label=agent_label,
            agent_label_source=agent_label_source,
            span_name=span_name,
            model=model,
            call_count=int(row.get(COUNT) or 0),
            sampled_call_count=int(row.get(COUNT_SAMPLE) or 0),
            sum_input_tokens=_token_count(row, SUM_INPUT_TOKENS),
            sum_cache_read_tokens=_token_count(row, SUM_CACHE_READ_TOKENS),
            sum_cache_creation_tokens=_token_count(row, SUM_CACHE_CREATION_TOKENS),
            avg_input_tokens=_token_count(row, AVG_INPUT_TOKENS),
        )
        seen = call_sites.get(stats.group_key)
        call_sites[stats.group_key] = stats if seen is None else _combine(seen, stats)
    return list(call_sites.values())


def fetch_call_site_stats(project: Project, window: DetectionWindow) -> list[CallSiteStats]:
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
    return _to_call_sites(result.get("data", []))


def fetch_call_site_warmth(
    project: Project, stats: CallSiteStats, window: DetectionWindow
) -> CallSiteWarmth | None:
    """Count one call site's calls per cache-TTL bucket across the window.

    Bucketing is what makes warmth computable at all: EAP has no window function
    to take the gap between consecutive calls, and reading a timestamp per call
    would be tens of thousands of rows for a single busy call site.

    The filter selects the call site whole -- every operation name under an
    agent, as its identity does -- so the counts arrive already folded, and the
    first call in a bucket is the only cold start in it.

    Each bucket's stored-span count is read alongside its call count, because
    ``count()`` is extrapolated and bucket occupancy is not: counting a bucket
    once while counting its calls at full volume would divide two different
    scales.

    Returns None when the group cannot be queried, meaning warmth is unknowable.
    """
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
    """Pair each timeseries bucket's extrapolated count with its stored-span count.

    ``processed_timeseries`` carries the two as separate lists indexed alike.
    A bucket missing its sample count is passed through with zero, which
    ``CallSiteWarmth`` reads as "no evidence of warmth here".
    """
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
    """Instrumentation-gap probe: how many of the group's spans carry any cache attribute.

    Returns None when the group cannot be queried, meaning presence is unknowable.
    """
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
    """Sample the group's largest calls, one per trace.

    Ordering by input tokens surfaces the calls where the wasted spend is most
    visible, which are also the most useful ones to open and compare.
    """
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
    """Read the prompt text of a few of the call site's most recent invocations.

    Recency decides which ones rather than size: the shared prefix is a statement
    about the template the code assembles now, and the largest prompts skew
    towards whichever path happens to carry the most context. Rows are
    deduplicated by trace for the reason ``fetch_sample_calls`` does it -- a call
    site firing repeatedly inside one trace is one invocation's worth of
    evidence.

    Returns None when the group cannot be queried. An empty list means the spans
    carry no prompt text, which is the ordinary case.
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
        if trace_id and trace_id in seen_trace_ids:
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
