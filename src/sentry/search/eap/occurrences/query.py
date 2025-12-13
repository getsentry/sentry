import logging
from datetime import datetime

from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column as EAPColumn
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import TraceItemTableRequest
from sentry_protos.snuba.v1.request_common_pb2 import RequestMeta, TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeAggregation,
    AttributeKey,
    AttributeValue,
)
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import Function as EAPFunction
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import StrArray
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    AndFilter,
    ComparisonFilter,
    TraceItemFilter,
)

from sentry.utils import snuba_rpc

logger = logging.getLogger(__name__)


def count_occurrences(
    organization_id: int,
    project_ids: list[int],
    start: datetime,
    end: datetime,
    referrer: str,
    group_id: int | None = None,
    environments: list[str] | None = None,
) -> int:
    """
    Count the number of occurrences in EAP matching the given filters.

    Args:
        organization_id: The organization ID
        project_ids: List of project IDs to query
        start: Start timestamp
        end: End timestamp
        referrer: Referrer string for the query
        group_id: Optional group ID to filter by
        environments: Optional list of environments to filter by

    Returns:
        The count of matching occurrences, or 0 if the query fails
    """
    start_timestamp = Timestamp()
    start_timestamp.FromDatetime(start)
    end_timestamp = Timestamp()
    end_timestamp.FromDatetime(end)

    count_column = EAPColumn(
        aggregation=AttributeAggregation(
            aggregate=EAPFunction.FUNCTION_COUNT,
            key=AttributeKey(name="group_id", type=AttributeKey.TYPE_INT),
        ),
        label="count",
    )

    filters: list[TraceItemFilter] = []

    if group_id is not None:
        group_id_filter = TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="group_id", type=AttributeKey.TYPE_INT),
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_int=group_id),
            )
        )
        filters.append(group_id_filter)

    if environments:
        environment_filter = TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="environment", type=AttributeKey.TYPE_STRING),
                op=ComparisonFilter.OP_IN,
                value=AttributeValue(val_str_array=StrArray(values=environments)),
            )
        )
        filters.append(environment_filter)

    item_filter = None
    if len(filters) == 1:
        item_filter = filters[0]
    elif len(filters) > 1:
        item_filter = TraceItemFilter(and_filter=AndFilter(filters=filters))

    request = TraceItemTableRequest(
        meta=RequestMeta(
            organization_id=organization_id,
            project_ids=project_ids,
            cogs_category="issues",
            referrer=referrer,
            start_timestamp=start_timestamp,
            end_timestamp=end_timestamp,
            trace_item_type=TraceItemType.TRACE_ITEM_TYPE_OCCURRENCE,
        ),
        columns=[count_column],
        filter=item_filter,
        limit=1,
    )

    try:
        count = 0
        responses = snuba_rpc.table_rpc([request])
        if responses and responses[0].column_values:
            results = responses[0].column_values[0].results
            if results:
                count = int(results[0].val_double)
        return count
    except Exception:
        logger.exception(
            "Fetching occurrence count from EAP failed",
            extra={
                "organization_id": organization_id,
                "project_ids": project_ids,
                "group_id": group_id,
                "referrer": referrer,
            },
        )
        return 0
