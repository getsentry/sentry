"""
This file contains methods which do not depend on the underlying data model used
by metrics. It should contain methods which do not rely on any specific columns.
So it contains only helper methods.
"""
from snuba_sdk import Function


def subtraction(arg1_snql, arg2_snql, alias: str | None = None) -> Function:
    return Function("minus", [arg1_snql, arg2_snql], alias)


def addition(arg1_snql, arg2_snql, alias: str | None = None) -> Function:
    return Function("plus", [arg1_snql, arg2_snql], alias)


def division_float(arg1_snql, arg2_snql, alias: str | None = None) -> Function:
    return Function(
        "divide",
        # Clickhouse can manage divisions by 0, see:
        # https://clickhouse.com/docs/en/sql-reference/functions/arithmetic-functions/#dividea-b-a-b-operator
        [arg1_snql, arg2_snql],
        alias=alias,
    )


def complement(arg1_snql, alias: str | None = None) -> Function:
    """(x) -> (1 - x)"""
    return Function("minus", [1.0, arg1_snql], alias=alias)
