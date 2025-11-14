from typing import int
import logging
import re
from datetime import UTC, datetime, timedelta

from sentry.models.project import Project
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.seer.sentry_data_models import Span, TraceData
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans
from sentry.web_vitals.types import WebVitalIssueDetectionType

logger = logging.getLogger(__name__)

# Regex to match unescaped quotes (not preceded by backslash)
UNESCAPED_QUOTE_RE = re.compile('(?<!\\\\)"')


def get_trace_by_web_vital_measurement(
    transaction_name: str,
    project_id: int,
    vital: WebVitalIssueDetectionType,
    min_value: float,
    start_time_delta: dict[str, int],
) -> TraceData | None:
    """
    Get a sample trace for a given transaction with a web vital measurement greater than or equal to the minimum value provided.

    Args:
        transaction_name: The name of the transaction to find traces for
        project_id: The ID of the project
        vital: Optional web vital metric to use for selection (e.g., "lcp", "fcp")
        min_value: The minimum value of the web vital measurement to use for selection
    Returns:
        TraceData
    """
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return None

    end_time = datetime.now(UTC)
    start_time = end_time - timedelta(**start_time_delta)

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

    selected_columns = [
        "trace",
        f"measurements.{vital}",
    ]

    traces_result = Spans.run_table_query(
        params=snuba_params,
        query_string=f'transaction:"{escaped_transaction_name}" project.id:{project_id} measurements.{vital}:>={min_value}',
        selected_columns=selected_columns,
        orderby=[f"measurements.{vital}"],
        offset=0,
        limit=1,
        referrer=Referrer.SEER_RPC,
        config=config,
        sampling_mode="NORMAL",
    )

    data = traces_result.get("data")
    if not data or len(data) == 0 or not data[0].get("trace"):
        return None
    trace_id = data[0].get("trace")

    # TODO: This function only gets used in web_vitals_issue_detection at the moment, which only utilizes the trace_id.
    # We don't need to fetch the spans for now, so we use an empty list to satisfy the class. Consider just returning
    # the trace_id instead, or update this to fetch spans.
    spans: list[Span] = []

    return TraceData(
        trace_id=trace_id,
        project_id=project_id,
        transaction_name=transaction_name,
        total_spans=len(spans),
        spans=spans,
    )
