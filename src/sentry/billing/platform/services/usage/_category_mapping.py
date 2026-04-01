from __future__ import annotations

import logging

from sentry_protos.billing.v1.data_category_pb2 import DataCategory as ProtoDataCategory

from sentry.constants import DataCategory
from sentry.utils import metrics

logger = logging.getLogger(__name__)

# Proto DataCategory enum uses different int values from Relay/Sentry DataCategory.
# e.g., Proto ATTACHMENT=3 vs Relay ATTACHMENT=4.
# ClickHouse stores Relay ints. The proto request carries proto ints.
# This mapping converts between the two.
PROTO_TO_RELAY_CATEGORY: dict[int, int] = {
    ProtoDataCategory.DATA_CATEGORY_ERROR: int(DataCategory.ERROR),
    ProtoDataCategory.DATA_CATEGORY_TRANSACTION: int(DataCategory.TRANSACTION),
    ProtoDataCategory.DATA_CATEGORY_ATTACHMENT: int(DataCategory.ATTACHMENT),
    ProtoDataCategory.DATA_CATEGORY_PROFILE: int(DataCategory.PROFILE),
    ProtoDataCategory.DATA_CATEGORY_REPLAY: int(DataCategory.REPLAY),
    ProtoDataCategory.DATA_CATEGORY_MONITOR: int(DataCategory.MONITOR),
    ProtoDataCategory.DATA_CATEGORY_SPAN: int(DataCategory.SPAN),
    ProtoDataCategory.DATA_CATEGORY_USER_REPORT_V2: int(DataCategory.USER_REPORT_V2),
    ProtoDataCategory.DATA_CATEGORY_PROFILE_DURATION: int(DataCategory.PROFILE_DURATION),
    ProtoDataCategory.DATA_CATEGORY_LOG_BYTE: int(DataCategory.LOG_BYTE),
    ProtoDataCategory.DATA_CATEGORY_PROFILE_DURATION_UI: int(DataCategory.PROFILE_DURATION_UI),
    ProtoDataCategory.DATA_CATEGORY_SEER_AUTOFIX: int(DataCategory.SEER_AUTOFIX),
    ProtoDataCategory.DATA_CATEGORY_SEER_SCANNER: int(DataCategory.SEER_SCANNER),
    ProtoDataCategory.DATA_CATEGORY_SIZE_ANALYSIS: int(DataCategory.SIZE_ANALYSIS),
    ProtoDataCategory.DATA_CATEGORY_INSTALLABLE_BUILD: int(DataCategory.INSTALLABLE_BUILD),
    ProtoDataCategory.DATA_CATEGORY_TRACE_METRIC: int(DataCategory.TRACE_METRIC),
    ProtoDataCategory.DATA_CATEGORY_DEFAULT: int(DataCategory.DEFAULT),
    ProtoDataCategory.DATA_CATEGORY_SECURITY: int(DataCategory.SECURITY),
    ProtoDataCategory.DATA_CATEGORY_PROFILE_CHUNK: int(DataCategory.PROFILE_CHUNK),
    ProtoDataCategory.DATA_CATEGORY_PROFILE_CHUNK_UI: int(DataCategory.PROFILE_CHUNK_UI),
}


def proto_to_relay_category(proto_category: int) -> int:
    """Convert a proto DataCategory int to the Relay/Sentry int used in ClickHouse."""
    result = PROTO_TO_RELAY_CATEGORY.get(proto_category)
    if result is None:
        metrics.incr(
            "billing.proto_category_mapping.unmapped",
            tags={"proto_category": str(proto_category)},
            sample_rate=1.0,
        )
        return proto_category
    return result
