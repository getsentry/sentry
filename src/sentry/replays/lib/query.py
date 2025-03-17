"""Dynamic query parsing library."""

import uuid

from snuba_sdk import Column, Condition, Function, Identifier, Lambda
from snuba_sdk.conditions import And, Or
from snuba_sdk.expressions import Expression


def attempt_compressed_condition(
    result: list[Expression],
    condition: Condition,
    condition_type: And | Or,
):
    """Unnecessary query optimization.

    Improves legibility for query debugging. Clickhouse would flatten these nested OR statements
    internally anyway.

    (block OR block) OR block => (block OR block OR block)
    """
    if isinstance(result[-1], condition_type):
        result[-1].conditions.append(condition)
    else:
        result.append(condition_type([result.pop(), condition]))


def all_values_for_tag_key(key: str, tag_key_column: Column, tag_value_column: Column) -> Function:
    return Function(
        "arrayFilter",
        parameters=[
            Lambda(
                ["key", "mask"],
                Function("equals", parameters=[Identifier("mask"), 1]),
            ),
            tag_value_column,
            _bitmask_on_tag_key(key, tag_key_column),
        ],
    )


def _bitmask_on_tag_key(key: str, tag_key_column: Column) -> Function:
    """Create a bit mask.

    Returns an array where the integer 1 represents a match.
        e.g.: [0, 0, 1, 0, 1, 0]
    """
    return Function(
        "arrayMap",
        parameters=[
            Lambda(
                ["index", "key"],
                Function("equals", parameters=[Identifier("key"), key]),
            ),
            Function("arrayEnumerate", parameters=[tag_key_column]),
            tag_key_column,
        ],
    )


def _wildcard_search_function(value, identifier):
    # XXX: We don't want the '^$' values at the beginning and end of
    # the regex since we want to find the pattern anywhere in the
    # message. Strip off here
    wildcard_value = value[1:-1]
    return Function(
        "match",
        parameters=[
            identifier,
            f"(?i){wildcard_value}",
        ],
    )


def _transform_uuids(values: list[str]) -> list[str] | None:
    try:
        return [str(uuid.UUID(value)) for value in values]
    except ValueError:
        return None
