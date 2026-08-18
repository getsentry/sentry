"""EAP span queries for LLM prompt-cache usage detection."""

from __future__ import annotations

from dataclasses import dataclass

from sentry.llm_cache_detection.detection import CallSiteStats, DetectionWindow
from sentry.models.project import Project
from sentry.search.eap.types import EAPResponse, SearchResolverConfig
from sentry.search.events.types import SnubaParams, SnubaRow
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans

# `ai_client` is the ingestion-normalized marker for an LLM call, so this matches
# whatever op the SDK chose -- `gen_ai.chat`, `gen_ai.responses`,
# `gen_ai.text_completion`, `generate_content`. Matching an op directly would
# cover one integration: the op name varies per SDK and per provider.
#
# Agent spans carry their own operation type, which keeps the double counting out:
# invoke_agent re-aggregates the token usage of its child calls, against a null
# model. Embeddings are excluded by hand because they are LLM calls by this
# classification but have no prompt cache -- and for a model that only reports
# positive cache values, absent cache attributes would read as a genuine 0% hit
# rate rather than as the absence of the feature.
GEN_AI_CALL_FILTER = (
    "gen_ai.operation.type:ai_client "
    "!gen_ai.operation.name:embeddings "
    "has:gen_ai.usage.input_tokens"
)

INPUT_TOKENS = "gen_ai.usage.input_tokens"
MODEL = "gen_ai.request.model"

# Most integrations emit the deprecated aliases (`gen_ai.usage.input_tokens.cached`
# and `.cache_write`) rather than these names -- only langchain writes them
# directly. Querying the canonical names still covers both: the resolver carries
# a backfill deprecation from each alias to its replacement, so reading either
# family here would double-count.
CACHE_READ_TOKENS = "gen_ai.usage.cache_read.input_tokens"
CACHE_CREATION_TOKENS = "gen_ai.usage.cache_creation.input_tokens"
CACHE_TOKEN_ATTRIBUTES = (CACHE_READ_TOKENS, CACHE_CREATION_TOKENS)

# An aggregate column doubles as the key its value comes back under, so the
# query and the code reading the response share one name.
SUM_INPUT_TOKENS = f"sum({INPUT_TOKENS})"
AVG_INPUT_TOKENS = f"avg({INPUT_TOKENS})"
SUM_CACHE_READ_TOKENS = f"sum({CACHE_READ_TOKENS})"
SUM_CACHE_CREATION_TOKENS = f"sum({CACHE_CREATION_TOKENS})"

# Sorting by total input tokens keeps the worst offenders inside the cap even
# when a project has more distinct call sites than this.
CALL_SITE_GROUPS_LIMIT = 300
SAMPLE_CALLS_LIMIT = 3
# Sampled rows are deduplicated by trace, so ask for enough of them that a call
# site repeating within one trace still yields distinct examples.
SAMPLE_CALLS_QUERY_LIMIT = SAMPLE_CALLS_LIMIT * 3


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
    values = (stats.transaction, stats.span_description, stats.model)
    if any(_is_unexpressible(value) for value in values):
        return None
    transaction, span_description, model = (_escape_filter_value(value) for value in values)
    return " ".join(
        [
            GEN_AI_CALL_FILTER,
            f'transaction:"{transaction}"',
            f'span.description:"{span_description}"',
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
    )


def _token_count(row: SnubaRow, column: str) -> float:
    """Read a token column, treating a missing or null value as zero."""
    return float(row.get(column) or 0)


def fetch_call_site_stats(project: Project, window: DetectionWindow) -> list[CallSiteStats]:
    """Aggregate gen-AI call spans per (transaction, span.description, model)."""
    result = _run_spans_query(
        project,
        window,
        query_string=GEN_AI_CALL_FILTER,
        selected_columns=[
            "transaction",
            "span.description",
            MODEL,
            "count()",
            SUM_INPUT_TOKENS,
            SUM_CACHE_READ_TOKENS,
            SUM_CACHE_CREATION_TOKENS,
            AVG_INPUT_TOKENS,
        ],
        orderby=[f"-{SUM_INPUT_TOKENS}"],
        limit=CALL_SITE_GROUPS_LIMIT,
        referrer=Referrer.ISSUES_LLM_CACHE_DETECTION_CALL_SITES,
    )

    stats: list[CallSiteStats] = []
    for row in result.get("data", []):
        transaction = row.get("transaction")
        span_description = row.get("span.description")
        model = row.get(MODEL)
        if not transaction or not span_description or not model:
            continue
        stats.append(
            CallSiteStats(
                transaction=transaction,
                span_description=span_description,
                model=model,
                call_count=int(row.get("count()") or 0),
                sum_input_tokens=_token_count(row, SUM_INPUT_TOKENS),
                sum_cache_read_tokens=_token_count(row, SUM_CACHE_READ_TOKENS),
                sum_cache_creation_tokens=_token_count(row, SUM_CACHE_CREATION_TOKENS),
                avg_input_tokens=_token_count(row, AVG_INPUT_TOKENS),
            )
        )
    return stats


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
        selected_columns=["count()"],
        orderby=None,
        limit=1,
        referrer=Referrer.ISSUES_LLM_CACHE_DETECTION_CACHE_PRESENCE,
    )
    data = result.get("data", [])
    if not data:
        return 0
    return int(data[0].get("count()") or 0)


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
