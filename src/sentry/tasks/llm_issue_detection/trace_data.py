"""
Functions for fetching trace data optimized for LLM issue detection.
"""

from __future__ import annotations

import logging
import re
from datetime import UTC, datetime, timedelta

from sentry.models.project import Project
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.seer.sentry_data_models import EvidenceSpan, EvidenceTraceData
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans

logger = logging.getLogger(__name__)

# Regex to match unescaped quotes (not preceded by backslash)
UNESCAPED_QUOTE_RE = re.compile('(?<!\\\\)"')


def get_evidence_trace_for_llm_detection(
    transaction_name: str, project_id: int
) -> EvidenceTraceData | None:
    """
    Get trace data with performance metrics for LLM issue detection.

    Args:
        transaction_name: The name of the transaction to find traces for
        project_id: The ID of the project

    Returns:
        EvidenceTraceData with spans including performance metrics, or None if no traces found
    """
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        logger.exception(
            "Project does not exist; cannot fetch traces for LLM detection",
            extra={"project_id": project_id, "transaction_name": transaction_name},
        )
        return None

    end_time = datetime.now(UTC)
    start_time = end_time - timedelta(hours=24)

    snuba_params = SnubaParams(
        start=start_time,
        end=end_time,
        projects=[project],
        organization=project.organization,
    )
    config = SearchResolverConfig(
        auto_fields=True,
    )

    escaped_transaction_name = UNESCAPED_QUOTE_RE.sub('\\"', transaction_name)
    traces_result = Spans.run_table_query(
        params=snuba_params,
        query_string=f'transaction:"{escaped_transaction_name}" project.id:{project_id}',
        selected_columns=[
            "trace",
            "precise.start_ts",
        ],
        orderby=["precise.start_ts"],
        offset=0,
        limit=1,
        referrer=Referrer.SEER_RPC,
        config=config,
        sampling_mode="NORMAL",
    )

    trace_id = None
    for row in traces_result.get("data", []):
        trace_id = row.get("trace")
        if trace_id:
            break

    if not trace_id:
        logger.info(
            "No traces found for transaction (LLM detection)",
            extra={"transaction_name": transaction_name, "project_id": project_id},
        )
        return None

    spans_result = Spans.run_table_query(
        params=snuba_params,
        query_string=f"trace:{trace_id}",
        selected_columns=[
            "span_id",
            "parent_span",
            "span.op",
            "span.description",
            "precise.start_ts",
            "span.self_time",
            "span.duration",
            "span.status",
        ],
        orderby=["precise.start_ts"],
        offset=0,
        limit=1000,
        referrer=Referrer.SEER_RPC,
        config=config,
        sampling_mode="NORMAL",
    )

    evidence_spans: list[EvidenceSpan] = []
    for row in spans_result.get("data", []):
        span_id = row.get("span_id")
        parent_span_id = row.get("parent_span")
        span_op = row.get("span.op")
        span_description = row.get("span.description")
        span_exclusive_time = row.get("span.self_time")
        span_duration = row.get("span.duration")
        span_status = row.get("span.status")
        span_timestamp = row.get("precise.start_ts")

        if span_id:
            evidence_spans.append(
                EvidenceSpan(
                    span_id=span_id,
                    parent_span_id=parent_span_id,
                    op=span_op,
                    description=span_description or "",
                    exclusive_time=span_exclusive_time,
                    timestamp=span_timestamp,
                    data={
                        "duration": span_duration,
                        "status": span_status,
                    },
                )
            )

    return EvidenceTraceData(
        trace_id=trace_id,
        project_id=project_id,
        transaction_name=transaction_name,
        total_spans=len(evidence_spans),
        spans=evidence_spans,
    )
