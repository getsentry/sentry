import logging

from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.seer.sentry_data_models import EvidenceSpan, LLMDetectionTraceData
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans

logger = logging.getLogger(__name__)


def get_trace_for_llm_detection(
    snuba_params: SnubaParams,
    trace_id: str,
    config: SearchResolverConfig,
    project_id: int,
    transaction_name: str,
) -> LLMDetectionTraceData | None:
    """
    Uses get_trace_for_transaction, adds more fields to returned Spans.
    """
    # Step 2: Get all spans in the chosen trace
    spans_result = Spans.run_table_query(
        params=snuba_params,
        query_string=f"trace:{trace_id}",
        selected_columns=[
            "span_id",
            "parent_span",
            "span.op",
            "span.description",
            "span.self_time",
            "span.duration",
            "span.status",
            "precise.start_ts",
        ],
        orderby=["precise.start_ts"],
        offset=0,
        limit=1000,
        referrer=Referrer.SEER_RPC,
        config=config,
        sampling_mode="NORMAL",
    )

    # Step 4: Build span objects
    spans = []
    for row in spans_result.get("data", []):
        span_id = row.get("span_id")
        parent_span_id = row.get("parent_span")
        span_op = row.get("span.op")
        span_description = row.get("span.description")
        span_exclusive_time = row.get("span.self_time")
        span_duration = row.get("span.duration")
        span_status = row.get("span.status")

        additional_data = {}
        # put any additional span fields in here
        if span_duration is not None:
            additional_data["duration"] = span_duration
        if span_status is not None:
            additional_data["status"] = span_status

        if span_id:
            spans.append(
                EvidenceSpan(
                    span_id=span_id,
                    parent_span_id=parent_span_id,
                    op=span_op,
                    description=span_description or "",
                    exclusive_time=span_exclusive_time,
                    data=additional_data if additional_data else None,
                )
            )

    return LLMDetectionTraceData(
        trace_id=trace_id,
        project_id=project_id,
        transaction_name=transaction_name,
        total_spans=len(spans),
        spans=spans,
    )
