from __future__ import annotations

import logging
from collections.abc import Sequence

from sentry_protos.snuba.v1.endpoint_delete_trace_items_pb2 import (
    DeleteTraceItemsRequest,
    DeleteTraceItemsResponse,
)
from sentry_protos.snuba.v1.request_common_pb2 import (
    RequestMeta,
    TraceItemFilterWithType,
    TraceItemType,
)
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue, IntArray
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter, TraceItemFilter

from sentry.utils import snuba_rpc

logger = logging.getLogger(__name__)


def delete_groups_from_eap_rpc(
    organization_id: int,
    project_id: int,
    group_ids: Sequence[int],
    referrer: str = "deletions.group",
) -> DeleteTraceItemsResponse:
    """
    Delete occurrences from EAP for the given group IDs.
    """

    if not group_ids:
        raise ValueError("group_ids must not be empty")

    group_id_filter = _create_group_id_filter(list(group_ids))
    filter_with_type = TraceItemFilterWithType(
        item_type=TraceItemType.TRACE_ITEM_TYPE_OCCURRENCE,
        filter=group_id_filter,
    )

    request = DeleteTraceItemsRequest(
        meta=RequestMeta(
            organization_id=organization_id,
            project_ids=[project_id],
            referrer=referrer,
            cogs_category="deletions",
            trace_item_type=TraceItemType.TRACE_ITEM_TYPE_OCCURRENCE,
        ),
        filters=[filter_with_type],
    )
    response = snuba_rpc.delete_trace_items_rpc(request)

    return response


def _create_group_id_filter(group_ids: list[int]) -> TraceItemFilter:
    return TraceItemFilter(
        comparison_filter=ComparisonFilter(
            key=AttributeKey(
                type=AttributeKey.TYPE_INT,
                name="group_id",
            ),
            op=ComparisonFilter.OP_IN,
            value=AttributeValue(val_int_array=IntArray(values=group_ids)),
        )
    )
