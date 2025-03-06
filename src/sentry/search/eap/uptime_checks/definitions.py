from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType

from sentry.search.eap.columns import ColumnDefinitions
from sentry.search.eap.uptime_checks.attributes import (
    UPTIME_CHECK_ATTRIBUTE_DEFINITIONS,
    UPTIME_CHECK_VIRTUAL_CONTEXTS,
)

UPTIME_CHECK_DEFINITIONS = ColumnDefinitions(
    aggregates={},
    formulas={},
    columns=UPTIME_CHECK_ATTRIBUTE_DEFINITIONS,
    contexts=UPTIME_CHECK_VIRTUAL_CONTEXTS,
    trace_item_type=TraceItemType.TRACE_ITEM_TYPE_UPTIME_CHECK,
)
