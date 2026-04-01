from sentry_protos.snuba.v1.endpoint_trace_item_attributes_pb2 import (
    TraceItemAttributeNamesRequest,
)
from sentry_protos.snuba.v1.request_common_pb2 import RequestMeta
from sentry_protos.snuba.v1.request_common_pb2 import (
    TraceItemType as ProtoTraceItemType,
)
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ExistsFilter, OrFilter, TraceItemFilter

from sentry.search.eap import constants
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import SupportedTraceItemType
from sentry.snuba.referrer import Referrer
from sentry.utils import snuba_rpc
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor


def serialize_type(search_type: constants.SearchType) -> str:
    proto_type = constants.TYPE_MAP.get(search_type)
    if proto_type == constants.STRING:
        return "string"
    if proto_type == constants.BOOLEAN:
        return "boolean"
    # DOUBLE, INT, or anything else numeric
    return "number"


def _check_attributes_by_type(
    meta: RequestMeta,
    attr_type: AttributeKey.Type.ValueType,
    names: list[str],
) -> set[tuple[AttributeKey.Type.ValueType, str]]:
    """Check which typed attribute names exist in storage for the active window."""
    if not names:
        return set()

    requested_names = set(names)
    names_request = TraceItemAttributeNamesRequest(
        meta=meta,
        limit=10000,
        type=attr_type,
        intersecting_attributes_filter=TraceItemFilter(
            or_filter=OrFilter(
                filters=[
                    TraceItemFilter(
                        exists_filter=ExistsFilter(key=AttributeKey(type=attr_type, name=name))
                    )
                    for name in requested_names
                ]
            )
        ),
    )
    names_response = snuba_rpc.attribute_names_rpc(names_request)
    return {
        (attr_type, attribute.name)
        for attribute in names_response.attributes
        if attribute.name in requested_names
    }


# We want to limit the number of threads to the number of attribute types to avoid
# overwhelming the RPC server.
MAX_ATTRIBUTE_VALIDATION_THREADS = 3


def _check_attributes_exist(
    resolver: SearchResolver,
    item_type: SupportedTraceItemType,
    attrs_by_type: dict[AttributeKey.Type.ValueType, list[str]],
    referrer: Referrer = Referrer.API_TRACE_ITEM_ATTRIBUTE_VALIDATE,
) -> set[tuple[AttributeKey.Type.ValueType, str]]:
    """Check which typed attribute internal names exist in storage."""
    if not attrs_by_type:
        return set()

    meta = resolver.resolve_meta(referrer=referrer.value)
    meta.trace_item_type = constants.SUPPORTED_TRACE_ITEM_TYPE_MAP.get(
        item_type, ProtoTraceItemType.TRACE_ITEM_TYPE_SPAN
    )

    found: set[tuple[AttributeKey.Type.ValueType, str]] = set()
    with ContextPropagatingThreadPoolExecutor(
        thread_name_prefix="attr_validate",
        max_workers=MAX_ATTRIBUTE_VALIDATION_THREADS,
    ) as pool:
        futures = [
            pool.submit(_check_attributes_by_type, meta, attr_type, names)
            for attr_type, names in attrs_by_type.items()
        ]
        for future in futures:
            found.update(future.result())

    return found
