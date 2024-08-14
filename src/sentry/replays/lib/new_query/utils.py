"""Query utility module."""
from __future__ import annotations

from uuid import UUID

from snuba_sdk import Condition, Function, Op


def to_uuid(value: UUID) -> Function:
    return Function("toUUID", parameters=[str(value)])


def to_uuids(value: list[UUID]) -> list[Function]:
    return [to_uuid(v) for v in value]


def contains(condition: Condition) -> Condition:
    """Return true if any of the rows in the aggregation set match the condition."""
    return Condition(
        Function("sum", parameters=[translate_condition_to_function(condition)]), Op.NEQ, 0
    )


def does_not_contain(condition: Condition) -> Condition:
    """Return true if none of the rows in the aggregation set match the condition."""
    return Condition(
        Function("sum", parameters=[translate_condition_to_function(condition)]), Op.EQ, 0
    )


# Work-around for https://github.com/getsentry/snuba-sdk/issues/115
def translate_condition_to_function(condition: Condition) -> Function:
    """Transforms infix operations to prefix operations."""
    if condition.op == Op.EQ:
        return Function("equals", parameters=[condition.lhs, condition.rhs])
    elif condition.op == Op.NEQ:
        return Function("notEquals", parameters=[condition.lhs, condition.rhs])
    elif condition.op == Op.GT:
        return Function("greater", parameters=[condition.lhs, condition.rhs])
    elif condition.op == Op.GTE:
        return Function("greaterOrEquals", parameters=[condition.lhs, condition.rhs])
    elif condition.op == Op.LT:
        return Function("less", parameters=[condition.lhs, condition.rhs])
    elif condition.op == Op.LTE:
        return Function("lessOrEquals", parameters=[condition.lhs, condition.rhs])
    elif condition.op == Op.IN:
        return Function("in", parameters=[condition.lhs, condition.rhs])
    elif condition.op == Op.NOT_IN:
        return Function("notIn", parameters=[condition.lhs, condition.rhs])
    else:
        raise Exception(f"Didn't understand operation: {condition.op}")
