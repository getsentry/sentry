from collections.abc import Callable
from typing import Any

from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue
from sentry_protos.snuba.v1.trace_item_filter_pb2 import AndFilter, OrFilter, TraceItemFilter
from sentry_protos.snuba.v1.trace_item_pb2 import AnyValue, ArrayValue, KeyValue, KeyValueList

from sentry.db.models.fields.bounded import I64_MAX

_ATTRIBUTE_VALUE_CONSTRUCTORS: dict[
    AttributeKey.Type.ValueType, Callable[[Any], AttributeValue]
] = {
    AttributeKey.Type.TYPE_STRING: lambda v: AttributeValue(val_str=v),
    AttributeKey.Type.TYPE_INT: lambda v: AttributeValue(val_int=v),
    AttributeKey.Type.TYPE_DOUBLE: lambda v: AttributeValue(val_double=v),
    AttributeKey.Type.TYPE_FLOAT: lambda v: AttributeValue(val_float=v),
    AttributeKey.Type.TYPE_BOOLEAN: lambda v: AttributeValue(val_bool=v),
}


def anyvalue(value: Any) -> AnyValue:
    # TODO(telkins): remove duplicate implementations of _anyvalue in other code
    if isinstance(value, str):
        return AnyValue(string_value=value)
    elif isinstance(value, bool):
        return AnyValue(bool_value=value)
    elif isinstance(value, int):
        if value > I64_MAX or value < -I64_MAX - 1:
            return AnyValue(double_value=float(value))
        return AnyValue(int_value=value)
    elif isinstance(value, float):
        return AnyValue(double_value=value)
    elif isinstance(value, bytes):
        return AnyValue(bytes_value=value)
    elif isinstance(value, list):
        return AnyValue(array_value=ArrayValue(values=[anyvalue(v) for v in value]))
    elif isinstance(value, dict):
        return AnyValue(
            kvlist_value=KeyValueList(
                values=[KeyValue(key=k, value=anyvalue(v)) for k, v in value.items()]
            )
        )

    raise ValueError(f"Unsupported EAP value type for AnyValue: {type(value)}")


def create_attribute_value(attr_type: AttributeKey.Type.ValueType, value: Any) -> AttributeValue:
    constructor = _ATTRIBUTE_VALUE_CONSTRUCTORS.get(attr_type)
    if constructor is None:
        raise ValueError(f"Unsupported EAP AttributeKey type: {attr_type}.")
    return constructor(value)


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
