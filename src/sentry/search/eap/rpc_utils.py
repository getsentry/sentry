from sentry_protos.snuba.v1.trace_item_filter_pb2 import AndFilter, OrFilter, TraceItemFilter


def and_trace_item_filters(
    *trace_item_filters: TraceItemFilter | None,
) -> TraceItemFilter | None:
    filters: list[TraceItemFilter] = [f for f in trace_item_filters if f is not None]
    if not filters:
        return None

    if len(filters) == 1:
        return filters[0]

    return TraceItemFilter(and_filter=AndFilter(filters=filters))


def or_trace_item_filters(
    *trace_item_filters: TraceItemFilter | None,
) -> TraceItemFilter | None:
    filters: list[TraceItemFilter] = [f for f in trace_item_filters if f is not None]
    if not filters:
        return None

    if len(filters) == 1:
        return filters[0]

    return TraceItemFilter(or_filter=OrFilter(filters=filters))
