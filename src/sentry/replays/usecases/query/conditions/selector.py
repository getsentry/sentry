from __future__ import annotations

from typing import List

from snuba_sdk import Column, Condition, Function, Op

from sentry.replays.lib.selector.parse import QueryType
from sentry.replays.usecases.query.conditions.base import ComputedBase


class ClickSelector(ComputedBase[List[QueryType]]):
    """Click selector condition class."""

    @staticmethod
    def visit_eq(value: list[QueryType]) -> Condition:
        if len(value) == 0:
            return Condition(Function("identity", parameters=[1]), Op.EQ, 2)
        else:
            return search_selector(value)


# We are not targetting an aggregated result set.  We are targetting a row.  We're asking does
# this row match the selector and *if it does* record a hit represented as a "1" or a miss
# represented as a "0".
#
# If multiple selectors are provided then we are asking if any row matches any selector.
def search_selector(queries: list[QueryType]) -> Condition:
    conditions: list[Function] = []

    for query in queries:
        cmp_functions = []

        if query.alt:
            cmp_functions.append(equals(Column("click_alt"), query.alt))
        if query.aria_label:
            cmp_functions.append(equals(Column("click_aria_label"), query.aria_label))
        if query.classes:
            has_all = Function("hasAll", parameters=[Column("click_class"), query.classes])
            cmp_functions.append(equals(has_all, 1))
        if query.id:
            cmp_functions.append(equals(Column("click_id"), query.id))
        if query.role:
            cmp_functions.append(equals(Column("click_role"), query.role))
        if query.tag:
            cmp_functions.append(equals(Column("click_tag"), query.tag))
        if query.testid:
            cmp_functions.append(equals(Column("click_testid"), query.testid))
        if query.title:
            cmp_functions.append(equals(Column("click_title"), query.title))

        if cmp_functions:
            conditions.append(comparator("and", cmp_functions))

    return Condition(Function("sum", parameters=[comparator("or", conditions)]), Op.GT, 0)


def equals(lhs: Column, rhs: str | int) -> Function:
    return Function("equals", parameters=[lhs, rhs])


def comparator(comparison_fn: str, functions: list[Function]) -> Function:
    # Horrific work-around. Related: https://github.com/getsentry/snuba-sdk/issues/115
    if len(functions) == 0:
        return Condition(Function("identity", parameters=[1]), Op.EQ, 2)

    inner_condition = None

    for function in functions:
        if inner_condition:
            inner_condition = Function(comparison_fn, parameters=[inner_condition, function])
        else:
            inner_condition = function

    return inner_condition
