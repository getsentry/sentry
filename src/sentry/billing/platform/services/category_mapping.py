from __future__ import annotations

from sentry_protos.billing.v1.data_category_pb2 import DataCategory as ProtoDataCategory

from sentry.constants import DataCategory
from sentry.utils import metrics

SENTRY_TO_PROTO_CATEGORY: dict[int, int] = {
    int(DataCategory.ERROR): ProtoDataCategory.DATA_CATEGORY_ERROR,
    int(DataCategory.TRANSACTION): ProtoDataCategory.DATA_CATEGORY_TRANSACTION,
    int(DataCategory.ATTACHMENT): ProtoDataCategory.DATA_CATEGORY_ATTACHMENT,
    int(DataCategory.PROFILE): ProtoDataCategory.DATA_CATEGORY_PROFILE,
    int(DataCategory.REPLAY): ProtoDataCategory.DATA_CATEGORY_REPLAY,
    int(DataCategory.MONITOR): ProtoDataCategory.DATA_CATEGORY_MONITOR,
    int(DataCategory.SPAN): ProtoDataCategory.DATA_CATEGORY_SPAN,
    int(DataCategory.USER_REPORT_V2): ProtoDataCategory.DATA_CATEGORY_USER_REPORT_V2,
    int(DataCategory.PROFILE_DURATION): ProtoDataCategory.DATA_CATEGORY_PROFILE_DURATION,
    int(DataCategory.LOG_BYTE): ProtoDataCategory.DATA_CATEGORY_LOG_BYTE,
    int(DataCategory.PROFILE_DURATION_UI): ProtoDataCategory.DATA_CATEGORY_PROFILE_DURATION_UI,
    int(DataCategory.SEER_AUTOFIX): ProtoDataCategory.DATA_CATEGORY_SEER_AUTOFIX,
    int(DataCategory.SEER_SCANNER): ProtoDataCategory.DATA_CATEGORY_SEER_SCANNER,
    int(DataCategory.SIZE_ANALYSIS): ProtoDataCategory.DATA_CATEGORY_SIZE_ANALYSIS,
    int(DataCategory.INSTALLABLE_BUILD): ProtoDataCategory.DATA_CATEGORY_INSTALLABLE_BUILD,
    int(DataCategory.TRACE_METRIC): ProtoDataCategory.DATA_CATEGORY_TRACE_METRIC,
    int(DataCategory.DEFAULT): ProtoDataCategory.DATA_CATEGORY_DEFAULT,
    int(DataCategory.SECURITY): ProtoDataCategory.DATA_CATEGORY_SECURITY,
    int(DataCategory.PROFILE_CHUNK): ProtoDataCategory.DATA_CATEGORY_PROFILE_CHUNK,
    int(DataCategory.PROFILE_CHUNK_UI): ProtoDataCategory.DATA_CATEGORY_PROFILE_CHUNK_UI,
}


PROTO_TO_SENTRY_CATEGORY: dict[int, int] = {v: k for k, v in SENTRY_TO_PROTO_CATEGORY.items()}


def proto_to_sentry_category(proto_category: int) -> int:
    """Convert a proto DataCategory to its Sentry equivalent.

    For categories with a known mapping, returns the sentry int value.
    For unmapped categories, passes through the original int value and
    emits a metric so we can track how often this happens.
    """
    result = PROTO_TO_SENTRY_CATEGORY.get(proto_category)
    if result is None:
        metrics.incr(
            "billing.proto_category_mapping.unmapped_reverse",
            tags={"proto_category": str(proto_category)},
        )
        return proto_category
    return result


def sentry_to_proto_category(category: int | DataCategory) -> ProtoDataCategory.ValueType:
    """Convert a Sentry DataCategory to its proto equivalent.

    For categories with a known mapping, returns the proto enum value.
    For unmapped categories, passes through the original int value and
    emits a metric so we can track how often this happens.
    """
    cat_int = int(category)
    result = SENTRY_TO_PROTO_CATEGORY.get(cat_int)
    if result is None:
        metrics.incr(
            "billing.proto_category_mapping.unmapped",
            tags={"sentry_category": str(cat_int)},
        )
        return ProtoDataCategory.ValueType(cat_int)
    return ProtoDataCategory.ValueType(result)
