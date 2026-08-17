"""EAP span queries for LLM prompt-cache usage detection."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sentry.llm_cache_detection.detection import DETECTION_WINDOW_DAYS, CallSiteStats
from sentry.models.project import Project
from sentry.search.eap.types import EAPResponse, SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans

# Restricting to generate_content is mandatory: invoke_agent spans re-aggregate
# the token usage of their child generate_content spans (double counting, null
# model) and embeddings spans have no prompt-cache concept.
GEN_AI_CALL_FILTER = "span.op:gen_ai.generate_content has:gen_ai.usage.input_tokens"

INPUT_TOKENS = "gen_ai.usage.input_tokens"
CACHE_READ_TOKENS = "gen_ai.usage.cache_read.input_tokens"
CACHE_CREATION_TOKENS = "gen_ai.usage.cache_creation.input_tokens"
MODEL = "gen_ai.request.model"

# Sorting by total input tokens keeps the worst offenders inside the cap even
# when a project has more distinct call sites than this.
CALL_SITE_GROUPS_LIMIT = 300
SAMPLE_TRACES_LIMIT = 3


def _build_snuba_params(project: Project) -> SnubaParams:
    end_time = datetime.now(UTC)
    return SnubaParams(
        start=end_time - timedelta(days=DETECTION_WINDOW_DAYS),
        end=end_time,
        projects=[project],
        organization=project.organization,
    )


def _escape_filter_value(value: str) -> str:
    """Escape a value for a quoted EAP search term.

    ``*`` must be escaped or OP_EQUALS silently degrades to a LIKE wildcard
    match; ``"`` would terminate the quoted term. Backslashes are left alone:
    the grammar never unescapes ``\\\\``, so callers must reject values that
    contain one instead.
    """
    return value.replace('"', '\\"').replace("*", "\\*")


def _build_group_filter(stats: CallSiteStats) -> str | None:
    """Build the exact-match filter for one call-site group.

    Returns None when a group value cannot be expressed in the search grammar.
    """
    values = (stats.transaction, stats.span_description, stats.model)
    if any("\\" in value for value in values):
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
    *,
    query_string: str,
    selected_columns: list[str],
    orderby: list[str] | None,
    limit: int,
    referrer: Referrer,
) -> EAPResponse:
    return Spans.run_table_query(
        params=_build_snuba_params(project),
        query_string=query_string,
        selected_columns=selected_columns,
        orderby=orderby,
        offset=0,
        limit=limit,
        referrer=referrer.value,
        config=SearchResolverConfig(auto_fields=True),
        sampling_mode="NORMAL",
    )


def fetch_call_site_stats(project: Project) -> list[CallSiteStats]:
    """Aggregate gen-AI call spans per (transaction, span.description, model)."""
    result = _run_spans_query(
        project,
        query_string=GEN_AI_CALL_FILTER,
        selected_columns=[
            "transaction",
            "span.description",
            MODEL,
            "count()",
            f"sum({INPUT_TOKENS})",
            f"sum({CACHE_READ_TOKENS})",
            f"sum({CACHE_CREATION_TOKENS})",
            f"avg({INPUT_TOKENS})",
        ],
        orderby=[f"-sum({INPUT_TOKENS})"],
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
                sum_input_tokens=float(row.get(f"sum({INPUT_TOKENS})") or 0),
                sum_cache_read_tokens=float(row.get(f"sum({CACHE_READ_TOKENS})") or 0),
                sum_cache_creation_tokens=float(row.get(f"sum({CACHE_CREATION_TOKENS})") or 0),
                avg_input_tokens=float(row.get(f"avg({INPUT_TOKENS})") or 0),
            )
        )
    return stats


def count_spans_with_cache_attributes(project: Project, stats: CallSiteStats) -> int | None:
    """Instrumentation-gap probe: how many of the group's spans carry any cache attribute.

    Returns None when the group cannot be queried, meaning presence is unknowable.
    """
    group_filter = _build_group_filter(stats)
    if group_filter is None:
        return None
    result = _run_spans_query(
        project,
        query_string=(f"{group_filter} (has:{CACHE_READ_TOKENS} OR has:{CACHE_CREATION_TOKENS})"),
        selected_columns=["count()"],
        orderby=None,
        limit=1,
        referrer=Referrer.ISSUES_LLM_CACHE_DETECTION_CACHE_PRESENCE,
    )
    data = result.get("data", [])
    if not data:
        return 0
    return int(data[0].get("count()") or 0)


def fetch_sample_trace_ids(project: Project, stats: CallSiteStats) -> list[str]:
    """Sample trace ids for a flagged group, largest input-token calls first."""
    group_filter = _build_group_filter(stats)
    if group_filter is None:
        return []
    result = _run_spans_query(
        project,
        query_string=group_filter,
        selected_columns=["trace", INPUT_TOKENS],
        orderby=[f"-{INPUT_TOKENS}"],
        limit=SAMPLE_TRACES_LIMIT,
        referrer=Referrer.ISSUES_LLM_CACHE_DETECTION_TRACE_SAMPLES,
    )

    trace_ids: list[str] = []
    for row in result.get("data", []):
        trace_id = row.get("trace")
        if trace_id and trace_id not in trace_ids:
            trace_ids.append(trace_id)
    return trace_ids
