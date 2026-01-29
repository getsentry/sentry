from __future__ import annotations

import logging
import random
import re
from datetime import UTC, datetime, timedelta

from sentry.models.project import Project
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.seer.explorer.utils import normalize_description
from sentry.seer.sentry_data_models import TraceMetadata
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans

logger = logging.getLogger(__name__)

# Regex to match unescaped quotes (not preceded by backslash)
UNESCAPED_QUOTE_RE = re.compile('(?<!\\\\)"')
LOWER_SPAN_LIMIT = 20
UPPER_SPAN_LIMIT = 500


def get_valid_trace_ids_by_span_count(
    trace_ids: list[str],
    snuba_params: SnubaParams,
    config: SearchResolverConfig,
) -> set[str]:
    """
    Query span counts for all trace_ids in one query.
    Return set of trace_ids with valid span counts.

    This filters out traces that are too small (lack context) or too large
    (exceed LLM context limits) before sending to Seer for analysis.
    """
    if not trace_ids:
        return set()

    result = Spans.run_table_query(
        params=snuba_params,
        query_string=f"trace:[{','.join(trace_ids)}]",
        selected_columns=["trace", "count()"],
        orderby=None,
        offset=0,
        limit=len(trace_ids),
        referrer=Referrer.ISSUES_LLM_ISSUE_DETECTION_SPAN_COUNT.value,
        config=config,
        sampling_mode="NORMAL",
    )

    return {
        row["trace"]
        for row in result.get("data", [])
        if LOWER_SPAN_LIMIT <= row["count()"] <= UPPER_SPAN_LIMIT
    }


def get_project_top_transaction_traces_for_llm_detection(
    project_id: int,
    limit: int,
    start_time_delta_minutes: int,
) -> list[TraceMetadata]:
    """
    Get top transactions by total time spent, return one semi-randomly chosen trace per transaction.
    Filters traces by span count before returning.
    """
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        logger.exception("Project does not exist", extra={"project_id": project_id})
        return []

    end_time = datetime.now(UTC)
    start_time = end_time - timedelta(minutes=start_time_delta_minutes)
    config = SearchResolverConfig(auto_fields=True)

    def _build_snuba_params(start: datetime) -> SnubaParams:
        """
        Both queries have different start times and the same end time.
        """
        return SnubaParams(
            start=start,
            end=end_time,
            projects=[project],
            organization=project.organization,
        )

    transaction_snuba_params = _build_snuba_params(start_time)

    transactions_result = Spans.run_table_query(
        params=transaction_snuba_params,
        query_string="is_transaction:true",
        selected_columns=[
            "transaction",
            "sum(span.duration)",
        ],
        orderby=["-sum(span.duration)"],
        offset=0,
        limit=limit,
        referrer=Referrer.ISSUES_LLM_ISSUE_DETECTION_TRANSACTION,
        config=config,
        sampling_mode="NORMAL",
    )

    trace_metadata = []
    seen_names = set()
    seen_trace_ids = set()
    random_offset = random.randint(1, 8)
    trace_snuba_params = _build_snuba_params(start_time + timedelta(minutes=random_offset))

    for row in transactions_result.get("data", []):
        transaction_name = row.get("transaction")
        if not transaction_name:
            continue

        normalized_name = normalize_description(transaction_name)
        if normalized_name in seen_names:
            continue

        escaped_transaction_name = UNESCAPED_QUOTE_RE.sub('\\"', transaction_name)
        trace_result = Spans.run_table_query(
            params=trace_snuba_params,
            query_string=f'is_transaction:true transaction:"{escaped_transaction_name}"',
            selected_columns=["trace", "precise.start_ts"],
            orderby=["precise.start_ts"],  # First trace in the window
            offset=0,
            limit=1,
            referrer=Referrer.ISSUES_LLM_ISSUE_DETECTION_TRACE,
            config=config,
            sampling_mode="NORMAL",
        )

        # Get the first (and only) result
        data = trace_result.get("data", [])
        if not data:
            continue

        trace_id = data[0].get("trace")
        if not trace_id or trace_id in seen_trace_ids:
            continue

        trace_metadata.append(
            TraceMetadata(
                trace_id=trace_id,
                transaction_name=normalized_name,
            )
        )
        seen_names.add(normalized_name)
        seen_trace_ids.add(trace_id)

    if not trace_metadata:
        return []

    all_trace_ids = [t.trace_id for t in trace_metadata]
    valid_trace_ids = get_valid_trace_ids_by_span_count(
        all_trace_ids, transaction_snuba_params, config
    )

    return [t for t in trace_metadata if t.trace_id in valid_trace_ids]
