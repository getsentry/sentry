from __future__ import annotations

from sentry_protos.billing.v1.data_category_pb2 import DataCategory as ProtoDataCategory

from sentry.constants import DataCategory
from sentry.utils import metrics


def _build_category_mapping() -> dict[int, int]:
    """Build mapping from Sentry DataCategory int values to Proto DataCategory
    int values by matching on enum member names.

    The two enums use different integer values for the same logical categories,
    so we match by name: e.g. Sentry's ``ERROR`` matches proto's
    ``DATA_CATEGORY_ERROR``.
    """
    proto_by_name: dict[str, int] = {
        desc.name.removeprefix("DATA_CATEGORY_"): desc.number
        for desc in ProtoDataCategory.DESCRIPTOR.values
        if desc.name not in ("DATA_CATEGORY_UNSPECIFIED", "DATA_CATEGORY_UNKNOWN")
    }
    mapping: dict[int, int] = {}
    for member in DataCategory:
        proto_value = proto_by_name.get(member.name)
        if proto_value is not None:
            mapping[int(member)] = proto_value
    return mapping


SENTRY_TO_PROTO_CATEGORY: dict[int, int] = _build_category_mapping()


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
    For unmapped categories, returns DATA_CATEGORY_UNKNOWN — the sentry and
    proto enums use different int values for the same logical categories
    (e.g. sentry SESSION=5 vs proto REPLAY=5), so passing the int through
    would silently land the row in the wrong proto bucket.
    """
    cat_int = int(category)
    result = SENTRY_TO_PROTO_CATEGORY.get(cat_int)
    if result is None:
        metrics.incr(
            "billing.proto_category_mapping.unmapped",
            tags={"sentry_category": str(cat_int)},
        )
        return ProtoDataCategory.DATA_CATEGORY_UNKNOWN
    return ProtoDataCategory.ValueType(result)
