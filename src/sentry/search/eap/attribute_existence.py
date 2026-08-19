from collections.abc import Collection, Mapping

from sentry_protos.snuba.v1.endpoint_trace_item_attributes_pb2 import TraceItemAttributeNamesRequest
from sentry_protos.snuba.v1.request_common_pb2 import RequestMeta
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ExistsFilter, OrFilter, TraceItemFilter

from sentry.utils import snuba_rpc
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor

# We want to limit the number of threads to avoid overwhelming the RPC server.
MAX_ATTRIBUTE_VALIDATION_THREADS = 3
ATTRIBUTE_NAME_LIMIT = 10_000


def _attribute_names_request(
    meta: RequestMeta,
    attr_type: AttributeKey.Type.ValueType,
    names: Collection[str],
    value_substring_match: str = "",
) -> TraceItemAttributeNamesRequest:
    return TraceItemAttributeNamesRequest(
        meta=meta,
        limit=ATTRIBUTE_NAME_LIMIT,
        type=attr_type,
        value_substring_match=value_substring_match,
        match_mode=TraceItemAttributeNamesRequest.MatchMode.MATCH_MODE_ANY,
        # TODO(wmak): Need to update snuba here so we can pass the list of attributes.
        # This filter narrows the rows we collect names from, snuba still returns
        # every name on those rows rather than just the ones we asked about, which is
        # what lets the limit page out the names we're checking for.
        intersecting_attributes_filter=TraceItemFilter(
            or_filter=OrFilter(
                filters=[
                    TraceItemFilter(
                        exists_filter=ExistsFilter(key=AttributeKey(type=attr_type, name=name))
                    )
                    for name in names
                ]
            )
        ),
    )


def attribute_name_exists(
    meta: RequestMeta,
    attr_type: AttributeKey.Type.ValueType,
    name: str,
) -> bool:
    """Check a single typed attribute name, matching on the name itself so it can't be paged out."""
    response = snuba_rpc.attribute_names_rpc(
        _attribute_names_request(meta, attr_type, [name], value_substring_match=name)
    )
    return any(attribute.name == name for attribute in response.attributes)


def _check_attribute_names_by_type(
    meta: RequestMeta,
    attr_type: AttributeKey.Type.ValueType,
    names: Collection[str],
) -> tuple[set[str], set[str]]:
    """Check which of the typed names exist in storage, and which the response can't rule out."""
    if not names:
        return set(), set()

    requested_names = set(names)
    response = snuba_rpc.attribute_names_rpc(
        _attribute_names_request(meta, attr_type, requested_names)
    )
    found = {
        attribute.name for attribute in response.attributes if attribute.name in requested_names
    }

    # Names come back alphabetically and capped at the limit, so an org with enough
    # attributes can page out the very name we filtered on
    if len(response.attributes) >= ATTRIBUTE_NAME_LIMIT:
        return found, requested_names - found

    return found, set()


def check_attribute_names_exist(
    meta: RequestMeta,
    names_by_type: Mapping[AttributeKey.Type.ValueType, Collection[str]],
) -> set[tuple[AttributeKey.Type.ValueType, str]]:
    """Check which typed attribute names exist in storage for the meta's window."""
    if not names_by_type:
        return set()

    found: set[tuple[AttributeKey.Type.ValueType, str]] = set()
    truncated: list[tuple[AttributeKey.Type.ValueType, str]] = []
    with ContextPropagatingThreadPoolExecutor(
        thread_name_prefix="attr_validate",
        max_workers=MAX_ATTRIBUTE_VALIDATION_THREADS,
    ) as pool:
        futures = {
            attr_type: pool.submit(_check_attribute_names_by_type, meta, attr_type, names)
            for attr_type, names in names_by_type.items()
        }
        for attr_type, future in futures.items():
            type_found, type_truncated = future.result()
            found.update((attr_type, name) for name in type_found)
            truncated.extend((attr_type, name) for name in type_truncated)

    if truncated:
        with ContextPropagatingThreadPoolExecutor(
            thread_name_prefix="attr_validate_by_name",
            max_workers=MAX_ATTRIBUTE_VALIDATION_THREADS,
        ) as pool:
            retries = {key: pool.submit(attribute_name_exists, meta, *key) for key in truncated}
            found.update(key for key, future in retries.items() if future.result())

    return found
