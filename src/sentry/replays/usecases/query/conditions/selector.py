"""Composite click selector visitor module.

This module demonstrates how funky condition visitors can become.  We're performing multiple
row-wise operations against a complex type and aggregating the result into a single integer before
asking whether any row in the aggregation set contained a result.
"""
from __future__ import annotations

from snuba_sdk import Column, Condition, Function, Op
from snuba_sdk.expressions import Expression

from sentry.replays.lib.new_query.conditions import GenericBase, StringArray, StringScalar
from sentry.replays.lib.new_query.utils import (
    contains,
    does_not_contain,
    translate_condition_to_function,
)
from sentry.replays.lib.selector.parse import QueryType
from sentry.replays.usecases.query.conditions.base import ComputedBase


class ClickScalar(GenericBase):
    """Click scalar condition class.

    Click scalar conditions can only be applied to click rows otherwise certain types of
    conditional checks will match against non-click rows and return incorrect data. For example,
    this query would return incorrect results without checking if the condition was applied to a
    click row: `?query=click.label=*`
    """

    @staticmethod
    def visit_eq(expression: Expression, value: str) -> Condition:
        return and_is_click_row(StringScalar.visit_eq(expression, value))

    @staticmethod
    def visit_neq(expression: Expression, value: str) -> Condition:
        return and_is_click_row(StringScalar.visit_neq(expression, value))

    @staticmethod
    def visit_match(expression: Expression, value: str) -> Condition:
        return and_is_click_row(StringScalar.visit_match(expression, value))

    @staticmethod
    def visit_not_match(expression: Expression, value: str) -> Condition:
        return and_is_click_row(StringScalar.visit_not_match(expression, value))

    @staticmethod
    def visit_in(expression: Expression, value: list[str]) -> Condition:
        return and_is_click_row(StringScalar.visit_in(expression, value))

    @staticmethod
    def visit_not_in(expression: Expression, value: list[str]) -> Condition:
        return and_is_click_row(StringScalar.visit_not_in(expression, value))


class SumOfClickScalar(GenericBase):
    """Aggregate click scalar condition class."""

    @staticmethod
    def visit_eq(expression: Expression, value: str) -> Condition:
        return contains(ClickScalar.visit_eq(expression, value))

    @staticmethod
    def visit_neq(expression: Expression, value: str) -> Condition:
        return does_not_contain(ClickScalar.visit_eq(expression, value))

    @staticmethod
    def visit_match(expression: Expression, value: str) -> Condition:
        return contains(ClickScalar.visit_match(expression, value))

    @staticmethod
    def visit_not_match(expression: Expression, value: str) -> Condition:
        return does_not_contain(ClickScalar.visit_match(expression, value))

    @staticmethod
    def visit_in(expression: Expression, value: list[str]) -> Condition:
        return contains(ClickScalar.visit_in(expression, value))

    @staticmethod
    def visit_not_in(expression: Expression, value: list[str]) -> Condition:
        return does_not_contain(ClickScalar.visit_in(expression, value))


class ClickArray(GenericBase):
    """Click array condition class.

    Click array conditions can only be applied to click rows otherwise certain types of
    conditional checks will match against non-click rows and return incorrect data. For example,
    this query would return incorrect results without checking if the condition was applied to a
    click row: `?query=click.label=*`
    """

    @staticmethod
    def visit_eq(expression: Expression, value: str) -> Condition:
        return and_is_click_row(StringArray.visit_eq(expression, value))

    @staticmethod
    def visit_neq(expression: Expression, value: str) -> Condition:
        return and_is_click_row(StringArray.visit_neq(expression, value))

    @staticmethod
    def visit_match(expression: Expression, value: str) -> Condition:
        return and_is_click_row(StringArray.visit_match(expression, value))

    @staticmethod
    def visit_not_match(expression: Expression, value: str) -> Condition:
        return and_is_click_row(StringArray.visit_not_match(expression, value))

    @staticmethod
    def visit_in(expression: Expression, value: list[str]) -> Condition:
        return and_is_click_row(StringArray.visit_in(expression, value))

    @staticmethod
    def visit_not_in(expression: Expression, value: list[str]) -> Condition:
        return and_is_click_row(StringArray.visit_not_in(expression, value))


class SumOfClickArray(GenericBase):
    """Aggregate click array condition class."""

    @staticmethod
    def visit_eq(expression: Expression, value: str) -> Condition:
        return contains(ClickArray.visit_eq(expression, value))

    @staticmethod
    def visit_neq(expression: Expression, value: str) -> Condition:
        return does_not_contain(ClickArray.visit_eq(expression, value))

    @staticmethod
    def visit_match(expression: Expression, value: str) -> Condition:
        return contains(ClickArray.visit_match(expression, value))

    @staticmethod
    def visit_not_match(expression: Expression, value: str) -> Condition:
        return does_not_contain(ClickArray.visit_match(expression, value))

    @staticmethod
    def visit_in(expression: Expression, value: list[str]) -> Condition:
        return contains(ClickArray.visit_in(expression, value))

    @staticmethod
    def visit_not_in(expression: Expression, value: list[str]) -> Condition:
        return does_not_contain(ClickArray.visit_in(expression, value))


#
# Selector condition classes.
#


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


class DeadClickSelectorComposite(ComputedBase):
    """Dead selector composite condition class."""

    @staticmethod
    def visit_eq(value: list[QueryType]) -> Condition:
        return is_dead_click(ClickSelectorComposite.visit_eq(value))

    @staticmethod
    def visit_neq(value: list[QueryType]) -> Condition:
        return is_dead_click(ClickSelectorComposite.visit_neq(value))


class RageClickSelectorComposite(ComputedBase):
    """Rage selector composite condition class."""

    @staticmethod
    def visit_eq(value: list[QueryType]) -> Condition:
        return is_rage_click(ClickSelectorComposite.visit_eq(value))

    @staticmethod
    def visit_neq(value: list[QueryType]) -> Condition:
        return is_rage_click(ClickSelectorComposite.visit_neq(value))


#
# Streaming selector condition classes.
#


class SumOfClickSelectorComposite(ComputedBase):
    """Streaming click selector composite condition class."""

    @staticmethod
    def visit_eq(value: list[QueryType]) -> Condition:
        return contains(ClickSelectorComposite.visit_eq(value))

    @staticmethod
    def visit_neq(value: list[QueryType]) -> Condition:
        return does_not_contain(ClickSelectorComposite.visit_eq(value))


class SumOfDeadClickSelectorComposite(ComputedBase):
    """Streaming dead click selector composite condition class."""

    @staticmethod
    def visit_eq(value: list[QueryType]) -> Condition:
        return contains(DeadClickSelectorComposite.visit_eq(value))

    @staticmethod
    def visit_neq(value: list[QueryType]) -> Condition:
        return does_not_contain(DeadClickSelectorComposite.visit_eq(value))


class SumOfRageClickSelectorComposite(ComputedBase):
    """Streaming rage click selector composite condition class."""

    @staticmethod
    def visit_eq(value: list[QueryType]) -> Condition:
        return contains(RageClickSelectorComposite.visit_eq(value))

    @staticmethod
    def visit_neq(value: list[QueryType]) -> Condition:
        return does_not_contain(RageClickSelectorComposite.visit_eq(value))


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
        if query.component_name:
            cmp_functions.append(equals(Column("click_component_name"), query.component_name))
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


def and_is_click_row(condition: Condition) -> Condition:
    """Return results from qualifying click rows.

    Click rows are defined as rows where click_tag's value is not the empty state. This function
    transforms a query from:

        (a = b)

    To:

        (a = b AND click_tag != '')
    """
    expression = Function(
        "and",
        parameters=[
            translate_condition_to_function(condition),
            translate_condition_to_function(StringScalar.visit_neq(Column("click_tag"), "")),
        ],
    )
    return Condition(expression, Op.EQ, 1)


def is_dead_click(condition: Condition) -> Condition:
    return Condition(
        Function("and", parameters=[condition.lhs, equals(Column("click_is_dead"), 1)]),
        Op.EQ,
        1,
    )


def is_rage_click(condition: Condition) -> Condition:
    return Condition(
        Function("and", parameters=[condition.lhs, equals(Column("click_is_rage"), 1)]),
        Op.EQ,
        1,
    )
