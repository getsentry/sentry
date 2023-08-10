"""Composite click selector visitor module.

This module demonstrates how funky condition visitors can become.  We're performing multiple
row-wise operations against a complex type and aggregating the result into a single integer before
asking whether any row in the aggregation set contained a result.
"""
from __future__ import annotations

from snuba_sdk import Column, Condition, Function, Op

from sentry.replays.lib.new_query.utils import contains, does_not_contain
from sentry.replays.lib.selector.parse import QueryType
from sentry.replays.usecases.query.conditions.base import ComputedBase


class ClickSelectorComposite(ComputedBase):
    """Click selector composite condition class."""

    @staticmethod
    def visit_eq(value: list[QueryType]) -> Condition:
        if len(value) == 0:
            # TODO: raise in the field or return the default condition in the field?
            return Condition(Function("identity", parameters=[1]), Op.EQ, 2)
        else:
            return Condition(search_selector(value), Op.EQ, 1)

    @staticmethod
    def visit_neq(value: list[QueryType]) -> Condition:
        if len(value) == 0:
            # TODO: raise in the field or return the default condition in the field?
            return Condition(Function("identity", parameters=[1]), Op.EQ, 2)
        else:
            return Condition(search_selector(value), Op.EQ, 0)


class SumOfClickSelectorComposite(ComputedBase):
    """Click selector composite condition class."""

    @staticmethod
    def visit_eq(value: list[QueryType]) -> Condition:
        return contains(ClickSelectorComposite.visit_eq(value))

    @staticmethod
    def visit_neq(value: list[QueryType]) -> Condition:
        return does_not_contain(ClickSelectorComposite.visit_eq(value))


# We are not targetting an aggregated result set.  We are targetting a row.  We're asking does
# this row match the selector and *if it does* record a hit represented as a "1" or a miss
# represented as a "0".
#
# If multiple selectors are provided then we are asking if any row matches any selector.
def search_selector(queries: list[QueryType]) -> Function:
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

    return comparator("or", conditions)


# Tl;dr we're nesting conditions like this `and(a, and(b, c))` instead of chaining them like
# this `a AND b AND c`.
#
# This is a work-around for: https://github.com/getsentry/snuba-sdk/issues/115
def comparator(comparison_fn: str, functions: list[Function]) -> Function:
    if len(functions) == 0:
        return Condition(Function("identity", parameters=[1]), Op.EQ, 2)

    inner_condition: Function | None = None

    for function in functions:
        if inner_condition is None:
            inner_condition = function
        else:
            inner_condition = Function(comparison_fn, parameters=[inner_condition, function])

    return inner_condition


def equals(lhs: Column, rhs: str | int) -> Function:
    return Function("equals", parameters=[lhs, rhs])
