from typing import cast

from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    AndFilter,
    ComparisonFilter,
    TraceItemFilter,
)

from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap import constants
from sentry.search.eap.columns import ResolvedArguments
from sentry.search.eap.normalizer import unquote_literal


def count_processor(count_value: int | None) -> int:
    if count_value is None:
        return 0
    return count_value


def resolve_attribute_value(
    attribute: AttributeKey, value: str, invalid_parameter_message: str | None = None
) -> AttributeValue:
    """Convert a string value to the appropriate AttributeValue based on the attribute type."""
    attr_value = None
    if invalid_parameter_message is None:
        invalid_parameter_message = f"Invalid parameter '{value}'"

    try:
        if attribute.type == AttributeKey.TYPE_DOUBLE:
            attr_value = AttributeValue(val_double=float(value))
        elif attribute.type == AttributeKey.TYPE_FLOAT:
            attr_value = AttributeValue(val_float=float(value))
        elif attribute.type == AttributeKey.TYPE_INT:
            attr_value = AttributeValue(val_int=int(value))
        else:
            value = unquote_literal(value)
            attr_value = AttributeValue(val_str=value)

    except ValueError:
        expected_type = "string"
        if attribute.type in [AttributeKey.TYPE_FLOAT, AttributeKey.TYPE_DOUBLE]:
            expected_type = "number"
        if attribute.type == AttributeKey.TYPE_INT:
            expected_type = "integer"
        raise InvalidSearchQuery(f"{invalid_parameter_message}. Must be of type {expected_type}.")

    if attribute.type == AttributeKey.TYPE_BOOLEAN:
        lower_value = value.lower()
        if lower_value not in ["true", "false"]:
            raise InvalidSearchQuery(
                f"{invalid_parameter_message}. Must be one of {['true', 'false']}"
            )
        attr_value = AttributeValue(val_bool=value == "true")

    return attr_value


def resolve_key_eq_value_filter(args: ResolvedArguments) -> tuple[AttributeKey, TraceItemFilter]:
    """
    Resolve arguments for conditional aggregates like count_if.

    Args format: [aggregate_key, filter_key, operator, value, optional_value2]
    Returns: (key_to_aggregate_on, filter_condition)
    """
    aggregate_key = cast(AttributeKey, args[0])
    key = cast(AttributeKey, args[1])
    operator = cast(str, args[2])

    value = args[3]
    assert isinstance(
        value, str
    ), "Value must be a String"  # This should always be a string. Assertion to deal with typing errors.

    attr_value = resolve_attribute_value(key, value, f"Invalid third parameter {value}")

    if operator == "between":
        value2 = args[4]

        assert isinstance(value2, str), "Third parameter must be a String"

        # TODO: A bit of a hack here, the default arg is set to an empty string so it's not treated as a required argument.
        # We check against the default arg to determine if the second value is missing.
        if value2 == "":
            raise InvalidSearchQuery("between operator requires two values")

        try:
            if float(value2) <= float(value):
                raise InvalidSearchQuery(
                    f"Fourth parameter {value2} must be greater than third parameter {value}"
                )
        except ValueError:
            raise InvalidSearchQuery("between operator requires two numbers")

        attr_value2 = resolve_attribute_value(key, value2, f"Invalid fourth parameter {value2}")
        trace_filter = TraceItemFilter(
            and_filter=AndFilter(
                filters=[
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=key,
                            op=ComparisonFilter.OP_GREATER_THAN_OR_EQUALS,
                            value=attr_value,
                        )
                    ),
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=key,
                            op=ComparisonFilter.OP_LESS_THAN_OR_EQUALS,
                            value=attr_value2,
                        )
                    ),
                ]
            )
        )
    else:
        trace_filter = TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=key,
                op=constants.LITERAL_OPERATOR_MAP[operator],
                value=attr_value,
            )
        )
    return (aggregate_key, trace_filter)
