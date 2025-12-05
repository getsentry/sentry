from __future__ import annotations

import logging
import random
import re
from datetime import UTC, datetime, timedelta

from sentry.models.project import Project
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.seer.explorer.utils import normalize_description
from sentry.seer.sentry_data_models import EvidenceTraceData
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans

logger = logging.getLogger(__name__)

# Regex to match unescaped quotes (not preceded by backslash)
UNESCAPED_QUOTE_RE = re.compile('(?<!\\\\)"')


def get_project_top_transaction_traces_for_llm_detection(
    project_id: int,
    limit: int,
    start_time_delta_minutes: int,
) -> list[EvidenceTraceData]:
    """
    Get top transactions by total time spent, return one semi-randomly chosen trace per transaction.
    """
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        logger.exception("Project does not exist", extra={"project_id": project_id})
        return []

    random_offset = random.randint(1, 8)
    end_time = datetime.now(UTC)
    start_time = end_time - timedelta(minutes=start_time_delta_minutes)

    # use for both queries to ensure they are searching the same time window
    snuba_params = SnubaParams(
        start=start_time,
        end=end_time,
        projects=[project],
        organization=project.organization,
    )
    config = SearchResolverConfig(auto_fields=True)

    # Step 1: Get top transactions by total time in time window
    transactions_result = Spans.run_table_query(
        params=snuba_params,
        query_string="is_transaction:true",
        selected_columns=[
            "transaction",
            "sum(span.duration)",
        ],
        orderby=["-sum(span.duration)"],
        offset=0,
        limit=limit,
        referrer=Referrer.SEER_RPC,
        config=config,
        sampling_mode="NORMAL",
    )

    evidence_traces = []
    seen_names = set()

    for row in transactions_result.get("data", []):
        transaction_name = row.get("transaction")
        if not transaction_name:
            continue

        normalized_name = normalize_description(transaction_name)
        if normalized_name in seen_names:
            continue

        # Step 2: Get ONE trace for this transaction from THE SAME time window
        escaped_transaction_name = UNESCAPED_QUOTE_RE.sub('\\"', transaction_name)
        trace_result = Spans.run_table_query(
            params=snuba_params,
            query_string=f'is_transaction:true transaction:"{escaped_transaction_name}"',
            selected_columns=["trace", "precise.start_ts"],
            orderby=["precise.start_ts"],  # First trace in the window
            offset=0,
            limit=1,
            referrer=Referrer.SEER_RPC,
            config=config,
            sampling_mode="NORMAL",
        )

        # Get the first (and only) result
        data = trace_result.get("data", [])
        if not data:
            continue

        trace_id = data[0].get("trace")
        if not trace_id:
            continue

        evidence_traces.append(
            EvidenceTraceData(
                trace_id=trace_id,
                transaction_name=normalized_name,
            )
        )
        seen_names.add(normalized_name)

    return evidence_traces
